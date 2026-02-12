import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shows } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { verifyWebhookSignature, parseWebhookPayload } from '@/lib/platforms/instagram/webhook';
import { processComment } from '@/lib/claim-engine/allocator';
import { broadcastToShow } from '@/lib/realtime/server';
import type { CommentInfo } from '@/lib/claim-engine/types';

/**
 * GET: Meta webhook verification handshake
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === 'subscribe' && token === verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

/**
 * POST: Receive Instagram webhook events
 */
export async function POST(req: NextRequest) {
  const appSecret = process.env.META_APP_SECRET;
  if (!appSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256') || '';

  if (!verifyWebhookSignature(rawBody, signature, appSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
  }

  const payload = JSON.parse(rawBody);
  const commentEvents = parseWebhookPayload(payload);

  // Process each comment event
  for (const event of commentEvents) {
    // Find active show matching this live_id
    const [show] = await db
      .select()
      .from(shows)
      .where(and(eq(shows.liveId, event.liveId), eq(shows.status, 'active')))
      .limit(1);

    if (!show) continue; // No active show for this live

    const commentInfo: CommentInfo = {
      platform: 'instagram',
      liveId: event.liveId,
      commentId: event.commentId,
      platformUserId: event.userId,
      userHandle: event.userHandle,
      userDisplayName: event.userDisplayName,
      rawText: event.text,
      timestamp: event.timestamp,
    };

    const result = await processComment(
      db,
      show.id,
      commentInfo,
      show.claimWord,
      show.passWord,
    );

    // Broadcast comment
    broadcastToShow(show.id, {
      type: 'comment.received',
      data: {
        showId: show.id,
        commentId: event.commentId,
        userHandle: event.userHandle,
        text: event.text,
        parsed: result.parsed,
        timestamp: event.timestamp.toISOString(),
      },
    });

    // Broadcast claim if created
    if (result.result && 'claimId' in result.result) {
      const r = result.result;
      if (r.status === 'winner' || r.status === 'waitlist' || r.status === 'unmatched') {
        broadcastToShow(show.id, {
          type: 'claim.created',
          data: {
            claimId: r.claimId,
            showId: show.id,
            itemNumber: r.itemNumber,
            userHandle: event.userHandle,
            claimStatus: r.status,
            waitlistPosition: r.status === 'waitlist' ? r.position : undefined,
            timestamp: event.timestamp.toISOString(),
          },
        });
      } else if (r.status === 'released') {
        broadcastToShow(show.id, {
          type: 'claim.released',
          data: {
            claimId: r.claimId,
            showId: show.id,
            itemNumber: r.itemNumber,
            userHandle: event.userHandle,
            promoted: r.promoted,
            timestamp: event.timestamp.toISOString(),
          },
        });

        if (r.item) {
          broadcastToShow(show.id, {
            type: 'item.updated',
            data: {
              itemId: r.item.id,
              showId: show.id,
              itemNumber: r.itemNumber,
              claimedCount: r.item.claimedCount,
              totalQuantity: r.item.totalQuantity,
              status: r.item.status,
            },
          });
        }
      }
    }
  }

  // Always return 200 to Meta to acknowledge receipt
  return NextResponse.json({ received: true });
}
