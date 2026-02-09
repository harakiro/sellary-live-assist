import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { showItems } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { addItemsSchema, addItemSchema } from '@/lib/validations/shows';

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
    ? (parsed.data as { items: Array<{ itemNumber: string; title: string; description?: string; totalQuantity: number }> }).items
    : [parsed.data as { itemNumber: string; title: string; description?: string; totalQuantity: number }];

  const inserted = await db
    .insert(showItems)
    .values(
      itemsToInsert.map((item) => ({
        showId,
        itemNumber: item.itemNumber,
        title: item.title,
        description: item.description,
        totalQuantity: item.totalQuantity,
      })),
    )
    .returning();

  return NextResponse.json({ data: inserted }, { status: 201 });
}

export const GET = withAuth(handleGet);
export const POST = withAuth(handlePost);
