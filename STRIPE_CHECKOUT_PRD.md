# Stripe Checkout Sessions — PRD

## Context

Invoice generation fails because `stripe.invoices.create()` requires a customer email, but we only have Facebook/Instagram platform handles. Stripe Checkout Sessions solve this — they generate a payment link where the buyer fills in their own email, shipping address, and payment info. No email required upfront.

This is a full replacement of the Stripe Invoice flow. All invoice-specific code and types will be removed and replaced with checkout session equivalents.

## Status Mapping (no DB migration needed)

| Checkout Session State | Existing DB `status` | Notes |
|---|---|---|
| Session created, URL available | `sent` | Immediately shareable |
| `checkout.session.completed` webhook | `paid` | Payment succeeded |
| `checkout.session.expired` webhook | `void` | Session expired (24h default) |
| Stripe API error during creation | `error` | Same as current |

The `draft` enum value goes unused but is harmless — no schema migration required.

## Files to Modify (5)

### 1. `src/lib/integrations/types.ts` — Replace invoice types with checkout types

- Remove `InvoiceParams`, `InvoiceResult`, `InvoiceStatusResult`, `InvoiceLineItem` types
- Add `CheckoutParams`, `CheckoutResult`, `CheckoutStatusResult`, `CheckoutLineItem` types
- Remove `createInvoice` and `getInvoiceStatus` from `IntegrationAdapter` interface
- Add `createCheckoutSession` and `getCheckoutStatus` to `IntegrationAdapter` interface
- `CheckoutParams` includes: `credentialsEnc`, `showId`, `showName`, `buyerHandle`, `buyerPlatformId`, `lineItems`, `currency?`, `memo?`
- `CheckoutResult` includes: `externalId` (session ID), `externalUrl` (checkout URL), `amountCents`, `currency`, `status`
- `CheckoutLineItem` includes: `itemNumber`, `title`, `quantity`, `unitAmountCents`

### 2. `src/lib/integrations/stripe/index.ts` — Replace adapter methods

**Remove entirely:**
- `createInvoice()` method — customer search/create, invoice creation, invoice item creation, invoice finalization
- `getInvoiceStatus()` method — invoice retrieval and status mapping

**Add `createCheckoutSession()`:**
- Build `line_items` with inline `price_data` (no separate product/price creation needed)
- Call `stripe.checkout.sessions.create()` with:
  - `mode: 'payment'`
  - `shipping_address_collection: { allowed_countries: ['US'] }`
  - `customer_creation: 'always'`
  - `metadata` with show/buyer info for webhook correlation
  - `success_url` / `cancel_url` built from `NEXT_PUBLIC_APP_URL`
- Return `session.id` as `externalId`, `session.url` as `externalUrl`, status `'sent'`

**Add `getCheckoutStatus()`:**
- `stripe.checkout.sessions.retrieve()`
- Map `payment_status === 'paid'` → `'paid'`, `status === 'expired'` → `'void'`

### 3. `src/lib/integrations/stripe/invoice.ts` — Update to use checkout adapter

- Update imports and calls to use `createCheckoutSession` instead of `createInvoice`
- Use `CheckoutLineItem` type instead of `InvoiceLineItem`
- Add `showId` to the adapter call params
- Fix idempotency check: allow retrying when the existing record has `status: 'error'` (delete the error record and regenerate instead of skipping)

### 4. `src/lib/integrations/stripe/webhook.ts` — New event types

**Remove:**
- `invoice.paid` handler
- `invoice.payment_failed` handler
- `invoice.voided` handler

**Add:**
- `checkout.session.completed` handler — marks record as `paid`, sets `paidAt`, broadcasts realtime event
- `checkout.session.expired` handler — marks record as `void`, broadcasts realtime event

Same DB update + `broadcastToShow()` pattern, just different Stripe event objects.

### 5. `src/components/integrations/invoice-panel.tsx` — Update labels

- "Invoices" → "Checkout Links" in header
- "Generate Invoices" → "Generate Checkout Links" button
- "Generated X invoices" → "Generated X checkout links" in result banner
- Update empty state text to reference checkout links

## Files to Create (2)

### 6. `src/app/checkout/success/page.tsx`

Simple public page (no auth required) — buyer-facing "Payment Successful! The seller has been notified and will be in touch about shipping."

### 7. `src/app/checkout/cancelled/page.tsx`

Simple public page (no auth required) — buyer-facing "Checkout cancelled. Ask the seller for a new checkout link if needed."

## Files Unchanged

- `src/lib/db/schema.ts` — no migration needed, reuse `invoices` table and `invoiceStatusEnum`
- `src/app/api/shows/[id]/invoices/route.ts` — returns DB records as-is
- `src/app/api/shows/[id]/invoices/generate/route.ts` — calls generation engine, unchanged
- `src/app/api/shows/[id]/invoices/[invoiceId]/send/route.ts` — returns `externalUrl`, works with checkout URL
- `src/app/api/webhooks/stripe/route.ts` — passes raw body to handler, unchanged
- `src/components/integrations/invoice-row.tsx` — displays records from DB, unchanged

## Verification

1. `npx tsc --noEmit` — no new type errors
2. Delete the existing error invoice record for show `275729c7-8b0c-4bc2-ad68-4504a416b7e1`, then click "Generate Checkout Links"
3. Verify the checkout URL opens Stripe's hosted checkout with line items, email field, shipping address, and payment form
4. Complete a test payment, verify the webhook marks the record as `paid` and the UI updates in real-time

## Stripe Dashboard Configuration

After deploying, update the Stripe webhook endpoint to subscribe to:
- `checkout.session.completed`
- `checkout.session.expired`

And remove subscriptions for:
- `invoice.paid`
- `invoice.payment_failed`
- `invoice.voided`
