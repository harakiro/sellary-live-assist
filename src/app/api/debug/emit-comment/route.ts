import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { shows } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { processComment } from '@/lib/claim-engine/allocator';
import { broadcastToShow } from '@/lib/realtime/server';
import type { CommentInfo } from '@/lib/claim-engine/types';

const schema = z.object({
  showId: z.string().uuid(),
  userId: z.string().min(1),
  userHandle: z.string().min(1),
  text: z.string().min(1),
  timestamp: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found' } }, { status: 404 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const { showId, userId, userHandle, text, timestamp } = parsed.data;

  const [show] = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
  if (!show) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Show not found' } },
      { status: 404 },
    );
  }

  const commentInfo: CommentInfo = {
    platform: show.platform || 'facebook',
    liveId: show.liveId || 'debug-live',
    commentId: `debug-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    platformUserId: userId,
    userHandle,
    userDisplayName: userHandle,
    rawText: text,
    timestamp: timestamp ? new Date(timestamp) : new Date(),
  };

  const result = await processComment(db, showId, commentInfo, show.claimWord, show.passWord);

  // Broadcast comment
  broadcastToShow(showId, {
    type: 'comment.received',
    data: {
      showId,
      commentId: commentInfo.commentId,
      userHandle,
      text,
      parsed: result.parsed,
      timestamp: commentInfo.timestamp.toISOString(),
    },
  });

  // Broadcast claim event if one was created
  if (result.result && 'claimId' in result.result) {
    const r = result.result;
    if (r.status === 'winner' || r.status === 'waitlist' || r.status === 'unmatched') {
      broadcastToShow(showId, {
        type: 'claim.created',
        data: {
          claimId: r.claimId,
          showId,
          itemNumber: r.itemNumber,
          userHandle,
          claimStatus: r.status,
          waitlistPosition: r.status === 'waitlist' ? r.position : undefined,
          timestamp: commentInfo.timestamp.toISOString(),
        },
      });
    } else if (r.status === 'released') {
      broadcastToShow(showId, {
        type: 'claim.released',
        data: {
          claimId: r.claimId,
          showId,
          itemNumber: r.itemNumber,
          userHandle,
          promoted: r.promoted,
          timestamp: commentInfo.timestamp.toISOString(),
        },
      });

      if (r.item) {
        broadcastToShow(showId, {
          type: 'item.updated',
          data: {
            itemId: r.item.id,
            showId,
            itemNumber: r.itemNumber,
            claimedCount: r.item.claimedCount,
            totalQuantity: r.item.totalQuantity,
            status: r.item.status,
          },
        });
      }
    }
  }

  return NextResponse.json({ data: result });
}
