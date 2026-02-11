# Feature: Stripe Integration & Integrations Framework

**Feature Slug:** `stripe-integration`
**Priority:** HIGH
**Architecture:** [ARCH_stripe-integration.md](../architecture/ARCH_stripe-integration.md)

---

## Task Breakdown

### FEAT-001: Integrations data model and framework scaffold

**Status:** TODO
**Depends:** (none)
**Size:** M

**Description:**
Create the integrations framework foundation: new database tables (`integrations`, `invoices`), enums, Drizzle schema additions, and the core adapter interfaces. Also add the `stripe` npm dependency.

This task is append-only to `schema.ts` — no modifications to existing table definitions. Creates the `src/lib/integrations/` directory with type definitions and the integration registry pattern.

Also adds the `price` column to `show_items` (integer, nullable, cents) to support optional per-item pricing for invoices.

**Acceptance Criteria:**
- [ ] `integrations` table defined in Drizzle schema with all columns from architecture doc
- [ ] `invoices` table defined in Drizzle schema with all columns from architecture doc
- [ ] New enums: `integration_provider`, `integration_status`, `invoice_status`
- [ ] `show_items.price` nullable integer column added
- [ ] `src/lib/integrations/types.ts` defines `IntegrationAdapter`, `IntegrationConfig`, `InvoiceParams`, `InvoiceResult` interfaces
- [ ] `src/lib/integrations/registry.ts` exports a registry that can discover/lookup adapters by provider
- [ ] `stripe` package added to dependencies
- [ ] Migration generates cleanly via `npm run db:generate`
- [ ] Existing tests still pass (no breaking changes)

**Files:**
- Modify: `src/lib/db/schema.ts` (append new tables + enums + show_items.price column)
- Create: `src/lib/integrations/types.ts`
- Create: `src/lib/integrations/registry.ts`
- Modify: `package.json` (add `stripe` dependency)
- Generate: `drizzle/` migration files

---

### FEAT-002: Stripe adapter — BYOK connection, credential management, and API routes

**Status:** TODO
**Depends:** FEAT-001
**Size:** M

**Description:**
Implement the Stripe adapter with BYOK (Bring Your Own Keys) connection. Operator provides their own Stripe Secret Key and Publishable Key. Credentials are encrypted using the existing AES-256-GCM system before storage.

Stripe Connect OAuth is deferred to a future iteration — it requires registering a Stripe platform application and going through Stripe's approval process.

API routes:
- `GET /api/integrations` — list available integrations with connection status
- `POST /api/integrations/stripe/connect` — connect via BYOK keys (accepts `{ secretKey, publishableKey }`)
- `DELETE /api/integrations/stripe` — disconnect
- `GET /api/integrations/stripe/test` — test connection health

The adapter validates keys by making a test call to the Stripe API (e.g. `stripe.balance.retrieve()`) and stores credentials encrypted on success. Disconnect clears the encrypted credentials and marks the integration inactive.

**Acceptance Criteria:**
- [ ] BYOK: operator provides Stripe secret key + publishable key, stored encrypted, connection marked active
- [ ] Key validation: invalid keys are rejected with a clear error before storing
- [ ] `GET /api/integrations` returns all available integrations with `connected: boolean` for each
- [ ] `GET /api/integrations/stripe/test` calls Stripe API and returns health status
- [ ] `DELETE /api/integrations/stripe` removes credentials and marks integration inactive
- [ ] Credentials never logged or returned in API responses
- [ ] All routes protected by auth middleware

**Files:**
- Create: `src/lib/integrations/stripe/index.ts`
- Create: `src/lib/integrations/stripe/types.ts`
- Create: `src/app/api/integrations/route.ts`
- Create: `src/app/api/integrations/stripe/connect/route.ts`
- Create: `src/app/api/integrations/stripe/route.ts` (DELETE + GET test)
- Modify: `.env.example` (add Stripe webhook secret env var)

---

### FEAT-003: Invoice generation engine — from claims to Stripe invoices

**Status:** TODO
**Depends:** FEAT-002
**Size:** L

**Description:**
Implement the invoice generation pipeline: query buyer rollup for a show, create Stripe invoices with line items for each buyer's claimed items, store invoice records in the database, and expose API routes.

Key logic:
- Buyer rollup query groups `winner` claims by `platform_user_id` for a given show
- For each buyer: create or lookup Stripe customer (by `platform_user_id` or `user_handle`), create invoice with line items (item number, title, price), finalize the invoice
- If `show_items.price` is set, use it; otherwise create line item with $0 (operator adjusts on Stripe)
- Store invoice record with `external_id`, `external_url` (Stripe hosted invoice URL), line items snapshot
- Handle partial generation (some buyers may fail — don't block others)

Also implements the Stripe webhook handler for payment status updates:
- `POST /api/webhooks/stripe` — verify signature, process `invoice.paid`, `invoice.payment_failed`, `invoice.voided`
- Update local invoice status on webhook events

API routes:
- `POST /api/shows/:id/invoices/generate` — generate invoices for all (or selected) buyers
- `GET /api/shows/:id/invoices` — list invoices for a show
- `POST /api/shows/:id/invoices/:invoiceId/send` — send/re-send checkout link (DM or manual)

**Acceptance Criteria:**
- [ ] `POST /api/shows/:id/invoices/generate` creates Stripe invoices for each buyer with claims
- [ ] Each invoice has correct line items matching buyer's claimed items
- [ ] Invoice records stored in DB with Stripe `external_id` and hosted URL
- [ ] Partial failures handled gracefully (per-buyer error, others proceed)
- [ ] `GET /api/shows/:id/invoices` returns all invoices with statuses
- [ ] Stripe webhook endpoint verifies signatures and updates invoice statuses
- [ ] `invoice.paid` webhook updates local record to 'paid' with `paid_at` timestamp
- [ ] Show must be in `ended` state (or have claims) to generate invoices
- [ ] Duplicate generation prevented (idempotent — don't recreate existing invoices for same buyer+show)

**Files:**
- Create: `src/lib/integrations/stripe/invoice.ts`
- Create: `src/lib/integrations/stripe/webhook.ts`
- Create: `src/app/api/shows/[id]/invoices/generate/route.ts`
- Create: `src/app/api/shows/[id]/invoices/route.ts`
- Create: `src/app/api/shows/[id]/invoices/[invoiceId]/send/route.ts`
- Create: `src/app/api/webhooks/stripe/route.ts`

---

### FEAT-004: Integrations Hub UI and Stripe connection page

**Status:** TODO
**Depends:** FEAT-002
**Size:** M

**Description:**
Build the Integrations Hub page (`/integrations`) and the Stripe connection/management page (`/integrations/stripe`). Add "Integrations" to the sidebar navigation.

**Integrations Hub** (`/integrations`):
- Tile grid of all integrations (Stripe active, others "Coming Soon")
- Each tile: provider logo/icon, name, short description, connection status badge
- Connected: green checkmark + "Manage" button
- Available: "Connect" button
- Coming Soon: muted tile with "Coming Soon" label
- Future: locked tiles with "Available on Pro" for tier gating

**Stripe Page** (`/integrations/stripe`):
- Secret Key + Publishable Key input fields, "Connect" button
- Key validation feedback (valid/invalid) on submit
- When connected: status indicator, test connection button, settings, disconnect button
- Settings: default currency, invoice memo template

**Navigation Update:**
- Add `{ href: '/integrations', label: 'Integrations', icon: Puzzle }` to sidebar nav between Connections and Settings

**Acceptance Criteria:**
- [ ] `/integrations` page shows tile grid with Stripe and Coming Soon tiles
- [ ] Stripe tile shows correct connection status (connected vs not)
- [ ] `/integrations/stripe` allows BYOK key entry and connection with validation
- [ ] Connected state shows status, test button, settings, disconnect
- [ ] Sidebar navigation includes "Integrations" link with appropriate icon
- [ ] Pages are responsive and match existing UI style

**Files:**
- Create: `src/app/(dashboard)/integrations/page.tsx`
- Create: `src/app/(dashboard)/integrations/stripe/page.tsx`
- Create: `src/components/integrations/integration-tile.tsx`
- Create: `src/components/integrations/stripe-byok-form.tsx`
- Modify: `src/app/(dashboard)/layout.tsx` (add nav item)

---

### FEAT-005: Invoice management UI — show invoice panel with buyer checkout

**Status:** TODO
**Depends:** FEAT-003, FEAT-004
**Size:** M

**Description:**
Add an "Invoices" section to the show detail/summary page. After a show ends (or has claims), operators can generate invoices, see per-buyer invoice status, send checkout links, and track payments.

**Invoice Panel (on show detail page):**
- Appears as a tab or section when show has claims and Stripe is connected
- "Generate Invoices" button — triggers bulk invoice creation for all buyers
- Buyer list table: buyer handle, items claimed (count), invoice status badge, amount, actions
- Per-buyer actions: "Generate" (if no invoice yet), "Send Link", "View on Stripe" (external link), "Copy Link"
- Status badges: Draft (gray), Sent (blue), Paid (green), Error (red)
- Progress indicator during bulk generation
- "Send All Links" button for batch sending

**Real-time updates:**
- When Stripe webhooks fire (invoice.paid), the UI updates via existing WebSocket infrastructure
- New event type: `invoice.updated` added to WebSocket events

**Acceptance Criteria:**
- [ ] Invoice section visible on show page when Stripe is connected and show has claims
- [ ] "Generate Invoices" creates invoices for all buyers and shows progress
- [ ] Invoice list shows correct per-buyer status with appropriate badges
- [ ] "Send Link" triggers checkout link delivery (or shows copyable URL)
- [ ] "View on Stripe" opens Stripe dashboard for the invoice
- [ ] Real-time status updates when payments are received
- [ ] Handles edge cases: no price set on items, buyer with no claims, already generated

**Files:**
- Create: `src/components/integrations/invoice-panel.tsx`
- Create: `src/components/integrations/invoice-row.tsx`
- Modify: `src/app/(dashboard)/shows/[id]/page.tsx` (add invoice section/tab)
- Modify: `src/lib/realtime/events.ts` (add `invoice.updated` event type)

---

### FEAT-006: Tests for integrations framework and Stripe adapter

**Status:** TODO
**Depends:** FEAT-003
**Size:** M

**Description:**
Comprehensive test coverage for the integrations framework:

**Unit tests:**
- Integration registry: register/lookup adapters
- Stripe credential encryption round-trip
- Invoice generation logic (buyer rollup → line items mapping)
- Stripe webhook signature verification
- Invoice status state machine transitions

**Integration tests (against test DB):**
- Full invoice generation flow: create show → add items with prices → add claims → generate invoices → verify DB records
- Webhook processing: simulate Stripe webhook → verify invoice status updated
- Duplicate invoice prevention (generate twice → no duplicates)
- Partial failure handling (one buyer fails → others succeed)
- Connection CRUD: connect → test → disconnect → verify cleanup

**Acceptance Criteria:**
- [ ] Unit tests cover adapter registry, credential handling, invoice logic
- [ ] Integration tests cover full invoice generation pipeline
- [ ] Webhook verification tested with valid and invalid signatures
- [ ] Duplicate generation prevention verified
- [ ] All tests pass with `npm run test`

**Files:**
- Create: `tests/unit/integrations/registry.test.ts`
- Create: `tests/unit/integrations/stripe-invoice.test.ts`
- Create: `tests/integration/invoices.test.ts`
- Create: `tests/integration/stripe-webhook.test.ts`
