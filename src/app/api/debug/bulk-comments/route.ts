import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { shows } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { processComment } from '@/lib/claim-engine/allocator';
import type { CommentInfo } from '@/lib/claim-engine/types';

const commentSchema = z.object({
  userId: z.string().min(1),
  userHandle: z.string().min(1),
  text: z.string().min(1),
  delay: z.number().int().min(0).optional(),
});

const schema = z.object({
  showId: z.string().uuid(),
  comments: z.array(commentSchema).min(1),
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

  const { showId, comments: commentInputs } = parsed.data;

  const [show] = await db.select().from(shows).where(eq(shows.id, showId)).limit(1);
  if (!show) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Show not found' } },
      { status: 404 },
    );
  }

  const results = [];

  for (const input of commentInputs) {
    if (input.delay) {
      await new Promise((resolve) => setTimeout(resolve, input.delay));
    }

    const commentInfo: CommentInfo = {
      platform: show.platform || 'facebook',
      liveId: show.liveId || 'debug-live',
      commentId: `debug-bulk-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      platformUserId: input.userId,
      userHandle: input.userHandle,
      userDisplayName: input.userHandle,
      rawText: input.text,
      timestamp: new Date(),
    };

    const result = await processComment(db, showId, commentInfo, show.claimWord, show.passWord);
    results.push({ input: input.text, ...result });
  }

  return NextResponse.json({ data: { processed: results.length, results } });
}
