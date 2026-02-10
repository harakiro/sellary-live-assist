import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, workspaces } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';

async function handler(req: AuthenticatedRequest) {
  const { userId, workspaceId } = req.auth;

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'User not found' } },
      { status: 404 },
    );
  }

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  return NextResponse.json({
    data: {
      user: { id: user.id, email: user.email, name: user.name },
      workspace: workspace ? { id: workspace.id, name: workspace.name, settings: workspace.settings } : null,
    },
  });
}

export const GET = withAuth(handler);
