import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { socialConnections } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';

async function handleGet(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const { workspaceId } = req.auth;
  const connectionId = context?.params?.id;

  if (!connectionId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Connection ID required' } },
      { status: 400 },
    );
  }

  const [connection] = await db
    .select()
    .from(socialConnections)
    .where(and(eq(socialConnections.id, connectionId), eq(socialConnections.workspaceId, workspaceId)))
    .limit(1);

  if (!connection) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Connection not found' } },
      { status: 404 },
    );
  }

  return NextResponse.json({
    data: {
      id: connection.id,
      platform: connection.platform,
      externalAccountId: connection.externalAccountId,
      displayName: connection.displayName,
      status: connection.status,
      tokenExpiresAt: connection.tokenExpiresAt,
      createdAt: connection.createdAt,
    },
  });
}

async function handleDelete(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const { workspaceId } = req.auth;
  const connectionId = context?.params?.id;

  if (!connectionId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Connection ID required' } },
      { status: 400 },
    );
  }

  const deleted = await db
    .delete(socialConnections)
    .where(and(eq(socialConnections.id, connectionId), eq(socialConnections.workspaceId, workspaceId)))
    .returning();

  if (deleted.length === 0) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Connection not found' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: { deleted: true } });
}

export const GET = withAuth(handleGet);
export const DELETE = withAuth(handleDelete);
