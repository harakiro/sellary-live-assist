import { NextRequest, NextResponse } from 'next/server';
import { handleStripeWebhook } from '@/lib/integrations/stripe/webhook';

export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json(
      { error: { code: 'MISSING_SIGNATURE', message: 'Missing stripe-signature header' } },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  try {
    const result = await handleStripeWebhook(rawBody, signature);
    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed';
    return NextResponse.json(
      { error: { code: 'WEBHOOK_ERROR', message } },
      { status: 400 },
    );
  }
}
