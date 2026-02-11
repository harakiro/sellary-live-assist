import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { integrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt } from '@/lib/encryption';
import { getAdapter } from '@/lib/integrations/registry';
import '@/lib/integrations/stripe/register';
import { z } from 'zod';

const connectSchema = z.object({
  secretKey: z.string().min(1, 'Secret key is required'),
  publishableKey: z.string().min(1, 'Publishable key is required'),
});

export const POST = withAuth(async (req: AuthenticatedRequest) => {
  const { workspaceId } = req.auth;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_BODY', message: 'Invalid JSON body' } },
      { status: 400 },
    );
  }

  const parsed = connectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0].message } },
      { status: 400 },
    );
  }

  const { secretKey, publishableKey } = parsed.data;
  const adapter = getAdapter('stripe');
  if (!adapter) {
    return NextResponse.json(
      { error: { code: 'ADAPTER_NOT_FOUND', message: 'Stripe adapter not registered' } },
      { status: 500 },
    );
  }

  // Validate credentials with Stripe API
  const validation = await adapter.validateCredentials({ secretKey, publishableKey });
  if (!validation.valid) {
    return NextResponse.json(
      { error: { code: 'INVALID_CREDENTIALS', message: validation.error || 'Invalid Stripe keys' } },
      { status: 400 },
    );
  }

  // Encrypt credentials
  const credentialsEnc = encrypt(JSON.stringify({ secretKey, publishableKey }));

  // Upsert integration record
  const existing = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspaceId),
        eq(integrations.provider, 'stripe'),
      ),
    );

  if (existing.length > 0) {
    await db
      .update(integrations)
      .set({
        status: 'active',
        credentialsEnc,
        connectedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(integrations.id, existing[0].id));
  } else {
    await db.insert(integrations).values({
      workspaceId,
      provider: 'stripe',
      status: 'active',
      displayName: 'Stripe',
      credentialsEnc,
      connectedAt: new Date(),
    });
  }

  return NextResponse.json({ data: { connected: true, provider: 'stripe' } });
});
