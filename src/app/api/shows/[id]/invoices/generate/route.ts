import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedRequest } from '@/lib/auth/middleware';
import { generateInvoicesForShow } from '@/lib/integrations/stripe/invoice';
import '@/lib/integrations/stripe/register';

export const POST = withAuth(async (req: AuthenticatedRequest, context) => {
  const showId = context?.params?.id;
  if (!showId) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Show ID required' } },
      { status: 400 },
    );
  }

  const { workspaceId } = req.auth;

  try {
    const result = await generateInvoicesForShow(showId, workspaceId);
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Invoice generation failed';
    return NextResponse.json(
      { error: { code: 'INVOICE_GENERATION_FAILED', message } },
      { status: 500 },
    );
  }
});
