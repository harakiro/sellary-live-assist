import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { workspaces } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  settings: z
    .object({
      defaultClaimWord: z.string().min(1).max(50).optional(),
      defaultPassWord: z.string().min(1).max(50).optional(),
      defaultPollingInterval: z.number().int().min(2).max(10).optional(),
    })
    .optional(),
});

async function handleGet(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const wsId = context?.params?.id;
  if (wsId !== req.auth.workspaceId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Not your workspace' } },
      { status: 403 },
    );
  }

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, wsId))
    .limit(1);

  if (!workspace) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Workspace not found' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: workspace });
}

async function handlePatch(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const wsId = context?.params?.id;
  if (wsId !== req.auth.workspaceId) {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Not your workspace' } },
      { status: 403 },
    );
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.settings) updates.settings = parsed.data.settings;

  const [updated] = await db
    .update(workspaces)
    .set(updates)
    .where(eq(workspaces.id, wsId!))
    .returning();

  return NextResponse.json({ data: updated });
}

export const GET = withAuth(handleGet);
export const PATCH = withAuth(handlePatch);
