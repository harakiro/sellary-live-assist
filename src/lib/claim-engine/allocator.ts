import { eq, and, sql } from 'drizzle-orm';
import type { Database } from '@/lib/db';
import { claims, showItems, shows, comments } from '@/lib/db/schema';
import { generateIdempotencyKey } from './idempotency';
import { normalizeComment, parseComment } from './parser';
import type {
  CommentInfo,
  ClaimResult,
  PassResult,
  ReleaseResult,
  AwardResult,
  ClaimIntent,
  PassIntent,
} from './types';

/**
 * Process a raw comment through the full claim pipeline:
 * normalize → parse → allocate/pass
 */
export async function processComment(
  db: Database,
  showId: string,
  comment: CommentInfo,
  claimWord = 'sold',
  passWord = 'pass',
): Promise<{ parsed: boolean; result: ClaimResult | PassResult | null }> {
  const normalizedText = normalizeComment(comment.rawText);
  const intent = parseComment(normalizedText, claimWord, passWord);

  // Store the comment
  await db.insert(comments).values({
    showId,
    liveId: comment.liveId,
    platform: comment.platform,
    platformUserId: comment.platformUserId,
    userHandle: comment.userHandle,
    commentId: comment.commentId,
    rawText: comment.rawText,
    normalizedText,
    parsed: intent !== null,
    receivedAt: comment.timestamp,
  });

  if (!intent) {
    return { parsed: false, result: null };
  }

  if (intent.type === 'claim') {
    const result = await processClaimIntent(db, showId, intent, comment);
    return { parsed: true, result };
  } else {
    const result = await processPassIntent(db, showId, intent, comment);
    return { parsed: true, result };
  }
}

/**
 * Allocate a claim within a transaction using row-level locking.
 */
export async function processClaimIntent(
  db: Database,
  showId: string,
  intent: ClaimIntent,
  comment: CommentInfo,
): Promise<ClaimResult> {
  const idempotencyKey = generateIdempotencyKey({
    platform: comment.platform,
    commentId: comment.commentId,
    liveId: comment.liveId,
    platformUserId: comment.platformUserId,
    normalizedText: intent.rawText,
    timestamp: comment.timestamp,
  });

  // Use a raw transaction for row-level locking
  const result = await db.transaction(async (tx) => {
    // Check show is active
    const [show] = await tx
      .select({ status: shows.status })
      .from(shows)
      .where(eq(shows.id, showId))
      .limit(1);

    if (!show || show.status !== 'active') {
      return { status: 'show_not_active' as const, itemNumber: intent.itemNumber };
    }

    // Lock the item row
    const itemRows = await tx.execute(
      sql`SELECT id, item_number, total_quantity, claimed_count, status
          FROM show_items
          WHERE show_id = ${showId} AND item_number = ${intent.itemNumber}
          FOR UPDATE`,
    );

    const item = itemRows.rows[0] as {
      id: string;
      item_number: string;
      total_quantity: number;
      claimed_count: number;
      status: string;
    } | undefined;

    if (!item) {
      return { status: 'item_not_found' as const, itemNumber: intent.itemNumber };
    }

    // Check idempotency
    const existingClaim = await tx
      .select({ id: claims.id })
      .from(claims)
      .where(eq(claims.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existingClaim.length > 0) {
      return { status: 'duplicate' as const, itemNumber: intent.itemNumber };
    }

    // Check deduplication (same user + same item with active claim)
    const userClaim = await tx
      .select({ id: claims.id })
      .from(claims)
      .where(
        and(
          eq(claims.showId, showId),
          eq(claims.platformUserId, comment.platformUserId),
          eq(claims.itemNumber, intent.itemNumber),
          sql`${claims.claimStatus} IN ('winner', 'waitlist')`,
        ),
      )
      .limit(1);

    if (userClaim.length > 0) {
      return { status: 'duplicate_user' as const, itemNumber: intent.itemNumber };
    }

    const available = item.total_quantity - item.claimed_count;

    if (available > 0) {
      // Winner
      const [claim] = await tx
        .insert(claims)
        .values({
          showId,
          showItemId: item.id,
          itemNumber: intent.itemNumber,
          platform: comment.platform,
          liveId: comment.liveId,
          platformUserId: comment.platformUserId,
          userHandle: comment.userHandle,
          userDisplayName: comment.userDisplayName,
          commentId: comment.commentId,
          rawText: comment.rawText,
          normalizedText: intent.rawText,
          claimType: 'claim',
          claimStatus: 'winner',
          idempotencyKey,
        })
        .returning();

      // Increment claimed count
      const newCount = item.claimed_count + 1;
      const newStatus = newCount >= item.total_quantity ? 'sold_out' : 'partial';

      await tx
        .update(showItems)
        .set({
          claimedCount: newCount,
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(showItems.id, item.id));

      return {
        status: 'winner' as const,
        claimId: claim.id,
        itemNumber: intent.itemNumber,
      };
    } else {
      // Waitlist — find next position
      const posResult = await tx.execute(
        sql`SELECT COALESCE(MAX(waitlist_position), 0) + 1 as next_pos
            FROM claims
            WHERE show_id = ${showId}
              AND item_number = ${intent.itemNumber}
              AND claim_status = 'waitlist'`,
      );
      const nextPosition = (posResult.rows[0] as { next_pos: number }).next_pos;

      const [claim] = await tx
        .insert(claims)
        .values({
          showId,
          showItemId: item.id,
          itemNumber: intent.itemNumber,
          platform: comment.platform,
          liveId: comment.liveId,
          platformUserId: comment.platformUserId,
          userHandle: comment.userHandle,
          userDisplayName: comment.userDisplayName,
          commentId: comment.commentId,
          rawText: comment.rawText,
          normalizedText: intent.rawText,
          claimType: 'claim',
          claimStatus: 'waitlist',
          waitlistPosition: nextPosition,
          idempotencyKey,
        })
        .returning();

      return {
        status: 'waitlist' as const,
        claimId: claim.id,
        itemNumber: intent.itemNumber,
        position: nextPosition,
      };
    }
  });

  return result;
}

/**
 * Process a pass intent — release the user's claim and promote waitlist.
 */
export async function processPassIntent(
  db: Database,
  showId: string,
  intent: PassIntent,
  comment: CommentInfo,
): Promise<PassResult> {
  return db.transaction(async (tx) => {
    // Find user's active claim (winner or waitlist) for this item
    const [userClaim] = await tx
      .select()
      .from(claims)
      .where(
        and(
          eq(claims.showId, showId),
          eq(claims.platformUserId, comment.platformUserId),
          eq(claims.itemNumber, intent.itemNumber),
          sql`${claims.claimStatus} IN ('winner', 'waitlist')`,
        ),
      )
      .limit(1);

    if (!userClaim) {
      return { status: 'no_active_claim' as const };
    }

    // Release the claim
    await tx
      .update(claims)
      .set({ claimStatus: 'passed', updatedAt: new Date() })
      .where(eq(claims.id, userClaim.id));

    if (userClaim.claimStatus === 'winner') {
      // Lock item row
      await tx.execute(
        sql`SELECT id FROM show_items WHERE id = ${userClaim.showItemId} FOR UPDATE`,
      );

      // Decrement claimed count
      await tx
        .update(showItems)
        .set({
          claimedCount: sql`GREATEST(${showItems.claimedCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(showItems.id, userClaim.showItemId));

      // Try to promote first waitlisted
      const [nextInLine] = await tx
        .select()
        .from(claims)
        .where(
          and(
            eq(claims.showId, showId),
            eq(claims.itemNumber, intent.itemNumber),
            eq(claims.claimStatus, 'waitlist'),
          ),
        )
        .orderBy(claims.waitlistPosition)
        .limit(1);

      if (nextInLine) {
        await tx
          .update(claims)
          .set({ claimStatus: 'winner', waitlistPosition: null, updatedAt: new Date() })
          .where(eq(claims.id, nextInLine.id));

        // Re-increment since promoted
        await tx
          .update(showItems)
          .set({
            claimedCount: sql`${showItems.claimedCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(showItems.id, userClaim.showItemId));

        // Update item status
        const [item] = await tx
          .select()
          .from(showItems)
          .where(eq(showItems.id, userClaim.showItemId));

        const newStatus =
          item.claimedCount >= item.totalQuantity
            ? 'sold_out'
            : item.claimedCount > 0
              ? 'partial'
              : 'unclaimed';

        await tx
          .update(showItems)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(showItems.id, userClaim.showItemId));

        return {
          status: 'released' as const,
          claimId: userClaim.id,
          promoted: { claimId: nextInLine.id, userHandle: nextInLine.userHandle || '' },
        };
      }

      // No one in waitlist — update item status
      const [item] = await tx
        .select()
        .from(showItems)
        .where(eq(showItems.id, userClaim.showItemId));

      const newStatus =
        item.claimedCount >= item.totalQuantity
          ? 'sold_out'
          : item.claimedCount > 0
            ? 'partial'
            : 'unclaimed';

      await tx
        .update(showItems)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(showItems.id, userClaim.showItemId));

      return { status: 'released' as const, claimId: userClaim.id };
    }

    // Was waitlist — just released, no promotion needed
    return { status: 'released' as const, claimId: userClaim.id };
  });
}

/**
 * Operator-initiated claim release.
 */
export async function releaseClaim(
  db: Database,
  claimId: string,
  operatorUserId: string,
): Promise<ReleaseResult> {
  return db.transaction(async (tx) => {
    const [claim] = await tx.select().from(claims).where(eq(claims.id, claimId)).limit(1);

    if (!claim) {
      return { status: 'claim_not_found' as const };
    }

    if (claim.claimStatus === 'released' || claim.claimStatus === 'passed') {
      return { status: 'already_released' as const };
    }

    await tx
      .update(claims)
      .set({
        claimStatus: 'released',
        operatorAction: true,
        operatorNotes: `Released by operator ${operatorUserId}`,
        updatedAt: new Date(),
      })
      .where(eq(claims.id, claimId));

    if (claim.claimStatus === 'winner') {
      // Lock + decrement
      await tx.execute(
        sql`SELECT id FROM show_items WHERE id = ${claim.showItemId} FOR UPDATE`,
      );

      await tx
        .update(showItems)
        .set({
          claimedCount: sql`GREATEST(${showItems.claimedCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(showItems.id, claim.showItemId));

      // Promote next in waitlist
      const [nextInLine] = await tx
        .select()
        .from(claims)
        .where(
          and(
            eq(claims.showId, claim.showId),
            eq(claims.itemNumber, claim.itemNumber),
            eq(claims.claimStatus, 'waitlist'),
          ),
        )
        .orderBy(claims.waitlistPosition)
        .limit(1);

      if (nextInLine) {
        await tx
          .update(claims)
          .set({ claimStatus: 'winner', waitlistPosition: null, updatedAt: new Date() })
          .where(eq(claims.id, nextInLine.id));

        await tx
          .update(showItems)
          .set({
            claimedCount: sql`${showItems.claimedCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(showItems.id, claim.showItemId));

        return {
          status: 'released' as const,
          promoted: { claimId: nextInLine.id, userHandle: nextInLine.userHandle || '' },
        };
      }

      // Update item status
      const [item] = await tx
        .select()
        .from(showItems)
        .where(eq(showItems.id, claim.showItemId));

      const newStatus =
        item.claimedCount >= item.totalQuantity
          ? 'sold_out'
          : item.claimedCount > 0
            ? 'partial'
            : 'unclaimed';

      await tx
        .update(showItems)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(showItems.id, claim.showItemId));
    }

    return { status: 'released' as const };
  });
}

/**
 * Operator manually awards an item to a user handle.
 */
export async function manualAward(
  db: Database,
  showId: string,
  itemId: string,
  userHandle: string,
  operatorUserId: string,
): Promise<AwardResult> {
  return db.transaction(async (tx) => {
    const itemRows = await tx.execute(
      sql`SELECT id, item_number, total_quantity, claimed_count
          FROM show_items
          WHERE id = ${itemId} AND show_id = ${showId}
          FOR UPDATE`,
    );

    const item = itemRows.rows[0] as {
      id: string;
      item_number: string;
      total_quantity: number;
      claimed_count: number;
    } | undefined;

    if (!item) {
      return { status: 'item_not_found' as const };
    }

    if (item.claimed_count >= item.total_quantity) {
      return { status: 'no_quantity_available' as const };
    }

    const idempotencyKey = generateIdempotencyKey({
      platform: 'facebook',
      commentId: `manual-${Date.now()}-${operatorUserId}`,
    });

    const [claim] = await tx
      .insert(claims)
      .values({
        showId,
        showItemId: item.id,
        itemNumber: item.item_number,
        platform: 'facebook',
        platformUserId: `manual-${userHandle}`,
        userHandle,
        claimType: 'claim',
        claimStatus: 'winner',
        idempotencyKey,
        operatorAction: true,
        operatorNotes: `Manually awarded by operator ${operatorUserId}`,
      })
      .returning();

    const newCount = item.claimed_count + 1;
    const newStatus = newCount >= item.total_quantity ? 'sold_out' : 'partial';

    await tx
      .update(showItems)
      .set({ claimedCount: newCount, status: newStatus, updatedAt: new Date() })
      .where(eq(showItems.id, item.id));

    return { status: 'awarded' as const, claimId: claim.id };
  });
}
