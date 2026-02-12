import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { showItems, claims, shows, socialConnections, workspaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { addItemsSchema, addItemSchema } from '@/lib/validations/shows';
import { resolveUnmatchedClaims } from '@/lib/claim-engine/allocator';
import { broadcastToShow } from '@/lib/realtime/server';
import { sendAutoReply, type ReplyCase } from '@/lib/platforms/facebook/reply';
import { logAuditEvent } from '@/lib/audit';

async function handleGet(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const showId = context?.params?.id;
  if (!showId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Show ID required' } },
      { status: 400 },
    );
  }

  const items = await db
    .select()
    .from(showItems)
    .where(eq(showItems.showId, showId))
    .orderBy(showItems.itemNumber);

  return NextResponse.json({ data: items });
}

async function handlePost(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const showId = context?.params?.id;
  if (!showId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Show ID required' } },
      { status: 400 },
    );
  }

  const body = await req.json();
  const isBatch = Array.isArray(body.items);
  const parsed = isBatch ? addItemsSchema.safeParse(body) : addItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const itemsToInsert = isBatch
    ? (parsed.data as { items: Array<{ itemNumber: string; title: string; description?: string; totalQuantity: number; price?: number | null }> }).items
    : [parsed.data as { itemNumber: string; title: string; description?: string; totalQuantity: number; price?: number | null }];

  try {
    const inserted = await db
      .insert(showItems)
      .values(
        itemsToInsert.map((item) => ({
          showId,
          itemNumber: item.itemNumber,
          title: item.title,
          description: item.description,
          totalQuantity: item.totalQuantity,
          price: item.price ?? null,
        })),
      )
      .returning();

    // Auto-resolve any unmatched claims for each newly created item
    for (const newItem of inserted) {
      const resolution = await resolveUnmatchedClaims(db, showId, newItem.id, newItem.itemNumber);

      if (resolution.resolved > 0) {
        // Broadcast summary event — the console updates existing entries in-place
        broadcastToShow(showId, {
          type: 'unmatched.resolved',
          data: {
            showId,
            itemNumber: newItem.itemNumber,
            resolved: resolution.resolved,
            winners: resolution.winners,
            waitlisted: resolution.waitlisted,
            timestamp: new Date().toISOString(),
          },
        });

        // Send auto-replies for resolved winner claims
        if (resolution.winners.length > 0) {
          try {
            const [show] = await db
              .select({
                connectionId: shows.connectionId,
                workspaceId: shows.workspaceId,
              })
              .from(shows)
              .where(eq(shows.id, showId))
              .limit(1);

            if (show?.connectionId) {
              const [connection] = await db
                .select({ encryptedAccessToken: socialConnections.encryptedAccessToken })
                .from(socialConnections)
                .where(eq(socialConnections.id, show.connectionId))
                .limit(1);

              const [ws] = await db
                .select({ settings: workspaces.settings })
                .from(workspaces)
                .where(eq(workspaces.id, show.workspaceId))
                .limit(1);

              const settings = (ws?.settings ?? {}) as {
                autoReplyEnabled?: boolean;
                replyTemplatesWinner?: string[];
                replyTemplatesWaitlist?: string[];
              };

              if (connection && settings.autoReplyEnabled) {
                const resolvedIds = [...resolution.winners, ...resolution.waitlisted];
                const resolvedClaims = await db
                  .select()
                  .from(claims)
                  .where(eq(claims.showId, showId))
                  .then((rows) => rows.filter((c) => resolvedIds.includes(c.id)));

                for (const claim of resolvedClaims) {
                  if (!claim.commentId) continue;

                  let replyCase: ReplyCase | null = null;
                  let templates: string[] = [];

                  if (resolution.winners.includes(claim.id)) {
                    replyCase = 'winner';
                    templates = settings.replyTemplatesWinner || [];
                  } else if (resolution.waitlisted.includes(claim.id)) {
                    replyCase = 'waitlist';
                    templates = settings.replyTemplatesWaitlist || [];
                  }

                  if (replyCase && templates.length > 0) {
                    sendAutoReply({
                      commentId: claim.commentId,
                      userDisplayName: claim.userDisplayName || claim.userHandle || 'unknown',
                      itemNumber: claim.itemNumber,
                      encryptedAccessToken: connection.encryptedAccessToken,
                      replyCase,
                      templates,
                    });
                  }
                }
              }
            }
          } catch (err) {
            console.error('[Items API] Auto-reply on resolve failed:', err);
          }
        }
      }
    }

    for (const item of inserted) {
      logAuditEvent(db, {
        workspaceId: req.auth.workspaceId,
        showId,
        actorUserId: req.auth.userId,
        action: 'item.created',
        entityType: 'show_item',
        entityId: item.id,
        details: { itemNumber: item.itemNumber, title: item.title },
      }).catch(() => {});
    }

    return NextResponse.json({ data: inserted }, { status: 201 });
  } catch (err: unknown) {
    const pgErr = err as { cause?: { code?: string } };
    if (pgErr.cause?.code === '23505') {
      return NextResponse.json(
        { error: { code: 'DUPLICATE_ITEM', message: 'An item with that number already exists in this show' } },
        { status: 409 },
      );
    }
    throw err;
  }
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
