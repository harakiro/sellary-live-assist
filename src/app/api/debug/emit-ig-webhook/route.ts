import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { shows } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { processComment } from '@/lib/claim-engine/allocator';
import { broadcastToShow } from '@/lib/realtime/server';
import type { CommentInfo } from '@/lib/claim-engine/types';

const schema = z.object({
  showId: z.string().uuid(),
  liveMediaId: z.string().min(1),
  userId: z.string().min(1),
  username: z.string().min(1),
  text: z.string().min(1),
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

  const { showId, liveMediaId, userId, username, text } = parsed.data;

  const [show] = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
  if (!show) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Show not found' } },
      { status: 404 },
    );
  }

  const commentInfo: CommentInfo = {
    platform: 'instagram',
    liveId: liveMediaId,
    commentId: `ig-debug-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    platformUserId: userId,
    userHandle: username,
    userDisplayName: username,
    rawText: text,
    timestamp: new Date(),
  };

  const result = await processComment(db, showId, commentInfo, show.claimWord, show.passWord);

  broadcastToShow(showId, {
    type: 'comment.received',
    data: {
      showId,
      commentId: commentInfo.commentId,
      userHandle: username,
      text,
      parsed: result.parsed,
      timestamp: commentInfo.timestamp.toISOString(),
    },
  });

  if (result.result && 'claimId' in result.result) {
    const r = result.result;
    if (r.status === 'winner' || r.status === 'waitlist') {
      broadcastToShow(showId, {
        type: 'claim.created',
        data: {
          claimId: r.claimId,
          showId,
          itemNumber: r.itemNumber,
          userHandle: username,
          claimStatus: r.status,
          waitlistPosition: r.status === 'waitlist' ? r.position : undefined,
          timestamp: commentInfo.timestamp.toISOString(),
        },
      });
    }
  }

  return NextResponse.json({ data: result });
}
