import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shows } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { createShowSchema } from '@/lib/validations/shows';

async function listShows(req: AuthenticatedRequest) {
  const { workspaceId } = req.auth;

  const result = await db
    .select()
    .from(shows)
    .where(eq(shows.workspaceId, workspaceId))
    .orderBy(desc(shows.createdAt));

  return NextResponse.json({ data: result });
}

async function createShow(req: AuthenticatedRequest) {
  const body = await req.json();
  const parsed = createShowSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const { workspaceId } = req.auth;

  const [show] = await db
    .insert(shows)
    .values({
      workspaceId,
      name: parsed.data.name,
      platform: parsed.data.platform,
      connectionId: parsed.data.connectionId,
      claimWord: parsed.data.claimWord,
      passWord: parsed.data.passWord,
    })
    .returning();

  return NextResponse.json({ data: show }, { status: 201 });
}

export const GET = withAuth(listShows);
export const POST = withAuth(createShow);
