import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { integrations } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';
import { getAdapter } from '@/lib/integrations/registry';
import '@/lib/integrations/stripe/register';
import Stripe from 'stripe';
import type { StripeCredentials } from '@/lib/integrations/stripe/types';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const { workspaceId } = req.auth;

  const [integration] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspaceId),
        eq(integrations.provider, 'stripe'),
      ),
    );

  if (!integration || integration.status !== 'active' || !integration.credentialsEnc) {
    return NextResponse.json(
      { error: { code: 'NOT_CONNECTED', message: 'Stripe is not connected' } },
      { status: 404 },
    );
  }

  const adapter = getAdapter('stripe');
  if (!adapter) {
    return NextResponse.json(
      { error: { code: 'ADAPTER_NOT_FOUND', message: 'Stripe adapter not registered' } },
      { status: 500 },
    );
  }

  const result = await adapter.testConnection(integration.credentialsEnc);
  return NextResponse.json({ data: { ...result, provider: 'stripe' } });
});

export const DELETE = withAuth(async (req: AuthenticatedRequest) => {
  const { workspaceId } = req.auth;

  const [integration] = await db
    .select()
    .from(integrations)
    .where(
      and(
        eq(integrations.workspaceId, workspaceId),
        eq(integrations.provider, 'stripe'),
      ),
    );

  if (!integration) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Stripe integration not found' } },
      { status: 404 },
    );
  }

  // Delete webhook endpoint from Stripe before clearing credentials
  if (integration.credentialsEnc) {
    try {
      const creds = JSON.parse(decrypt(integration.credentialsEnc)) as StripeCredentials;
      if (creds.webhookEndpointId) {
        const stripe = new Stripe(creds.secretKey, { apiVersion: '2026-01-28.clover' });
        if (creds.webhookEndpointId.startsWith('evt_dest_')) {
          await stripe.v2.core.eventDestinations.del(creds.webhookEndpointId);
        } else {
          await stripe.webhookEndpoints.del(creds.webhookEndpointId);
        }
      }
    } catch {
      // Keys may be revoked — safe to ignore
    }
  }

  await db
    .update(integrations)
    .set({
      status: 'inactive',
      credentialsEnc: null,
      connectedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(integrations.id, integration.id));

  return NextResponse.json({ data: { disconnected: true, provider: 'stripe' } });
});
