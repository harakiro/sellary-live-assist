import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { integrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { encrypt, decrypt } from '@/lib/encryption';
import { getAdapter } from '@/lib/integrations/registry';
import '@/lib/integrations/stripe/register';
import { z } from 'zod';
import Stripe from 'stripe';
import type { StripeCredentials } from '@/lib/integrations/stripe/types';

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

  // Check for existing integration (needed for reconnect cleanup)
  const existing = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspaceId),
        eq(integrations.provider, 'stripe'),
      ),
    );

  // If reconnecting, delete old webhook endpoint
  if (existing.length > 0 && existing[0].credentialsEnc) {
    try {
      const oldCreds = JSON.parse(decrypt(existing[0].credentialsEnc)) as StripeCredentials;
      if (oldCreds.webhookEndpointId) {
        const oldStripe = new Stripe(oldCreds.secretKey, { apiVersion: '2026-01-28.clover' });
        // Handle both v2 event destinations and v1 webhook endpoints
        if (oldCreds.webhookEndpointId.startsWith('evt_dest_')) {
          await oldStripe.v2.core.eventDestinations.del(oldCreds.webhookEndpointId);
        } else {
          await oldStripe.webhookEndpoints.del(oldCreds.webhookEndpointId);
        }
      }
    } catch {
      // Old keys may be revoked — safe to ignore
    }
  }

  // Auto-provision Stripe webhook via v2 Event Destinations API (skip for localhost)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const isPublicUrl = appUrl.length > 0 && !/localhost|127\.0\.0\.1/i.test(appUrl);

  let webhookSecret: string | undefined;
  let webhookEndpointId: string | undefined;

  if (isPublicUrl) {
    const stripe = new Stripe(secretKey, { apiVersion: '2026-01-28.clover' });
    const destination = await stripe.v2.core.eventDestinations.create({
      name: 'Sellary Live Assist',
      type: 'webhook_endpoint',
      event_payload: 'snapshot',
      snapshot_api_version: '2026-01-28.clover',
      enabled_events: ['checkout.session.completed', 'checkout.session.expired'],
      webhook_endpoint: { url: `${appUrl}/api/webhooks/stripe` },
      include: ['webhook_endpoint.signing_secret'],
    });
    webhookSecret = destination.webhook_endpoint?.signing_secret;
    webhookEndpointId = destination.id;
  } else {
    console.log('[stripe/connect] Skipped webhook provisioning — NEXT_PUBLIC_APP_URL is local:', appUrl);
  }

  // Encrypt credentials (webhook fields omitted in dev — use STRIPE_WEBHOOK_SECRET env var)
  const credentialsEnc = encrypt(
    JSON.stringify({
      secretKey,
      publishableKey,
      webhookSecret,
      webhookEndpointId,
    } satisfies StripeCredentials),
  );

  // Upsert integration record
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
