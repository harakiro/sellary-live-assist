import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/db';
import { integrations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { listAdapters } from '@/lib/integrations/registry';
import '@/lib/integrations/stripe/register';

export const GET = withAuth(async (req: AuthenticatedRequest) => {
  const { workspaceId } = req.auth;

  const adapters = listAdapters();
  const existing = await db
    .select()
    .from(integrations)
    .where(eq(integrations.workspaceId, workspaceId));

  const existingMap = new Map(existing.map((i) => [i.provider, i]));

  const result = adapters.map((adapter) => {
    const integration = existingMap.get(adapter.provider);
    return {
      provider: adapter.provider,
      displayName: adapter.displayName,
      description: adapter.description,
      connected: integration?.status === 'active',
      status: integration?.status || 'inactive',
      connectedAt: integration?.connectedAt?.toISOString() || null,
    };
  });

  // Add "coming soon" integrations not yet registered
  const comingSoon = ['shopify', 'square', 'medusajs'];
  for (const provider of comingSoon) {
    if (!adapters.some((a) => a.provider === provider)) {
      result.push({
        provider: provider as any,
        displayName: provider.charAt(0).toUpperCase() + provider.slice(1),
        description: 'Coming soon',
        connected: false,
        status: 'coming_soon' as any,
        connectedAt: null,
      });
    }
  }

  return NextResponse.json({ data: result });
});
