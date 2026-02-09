import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { showItems } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { updateItemSchema } from '@/lib/validations/shows';

async function handlePatch(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const itemId = context?.params?.itemId;
  const showId = context?.params?.id;

  if (!itemId || !showId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Show ID and Item ID required' } },
      { status: 400 },
    );
  }

  const body = await req.json();
  const parsed = updateItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(showItems)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(showItems.id, itemId), eq(showItems.showId, showId)))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Item not found' } },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: updated });
}

async function handleDelete(
  req: AuthenticatedRequest,
  context?: { params: Record<string, string> },
) {
  const itemId = context?.params?.itemId;
  const showId = context?.params?.id;

  if (!itemId || !showId) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Show ID and Item ID required' } },
      { status: 400 },
    );
  }

  const [item] = await db
    .select()
    .from(showItems)
    .where(and(eq(showItems.id, itemId), eq(showItems.showId, showId)))
    .limit(1);

  if (!item) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Item not found' } },
      { status: 404 },
    );
  }

  if (item.claimedCount > 0) {
    return NextResponse.json(
      { error: { code: 'CONFLICT', message: 'Cannot delete an item with existing claims' } },
      { status: 409 },
    );
  }

  await db
    .delete(showItems)
    .where(and(eq(showItems.id, itemId), eq(showItems.showId, showId)));

  return NextResponse.json({ data: { deleted: true } });
}

export const PATCH = withAuth(handlePatch);
export const DELETE = withAuth(handleDelete);
