# Architecture: Stripe Integration & Integrations Framework

## Overview

This feature introduces the **Integrations Framework** — a pluggable system for connecting third-party services to Sellary Live Assist. The first integration is **Stripe**, enabling operators to generate invoices from show claims and send checkout links to buyers via Facebook private message.

This architecture is designed for **upsell potential**: the integrations system is gated behind workspace-level feature flags, allowing free-tier users to see what's available while reserving functionality for paid plans.

---

## Strategic Design: Integrations as an Upsell

### Tiering Model

| Tier | Integrations Access |
|------|-------------------|
| Free / Starter | Core claim engine only. Integrations page visible but locked with "Upgrade" CTA. |
| Pro | Stripe integration (connect own keys or OAuth). Up to 1 payment provider. |
| Business | Multiple integrations, priority support, custom webhooks. |

### UX Presentation

The integrations hub is a **new top-level nav item** (`/integrations`) positioned between "Connections" and "Settings" in the sidebar. This gives it visibility without conflating it with social platform connections.

- **Integrations Hub** (`/integrations`): Tile grid of available integrations (Stripe, Shopify, Square, etc.). Each tile shows: logo, name, description, connection status, and a "Connect" or "Upgrade" CTA.
- **Connected integrations** show a green checkmark and "Manage" link.
- **Locked integrations** (wrong tier) show a lock icon and "Available on Pro" badge.
- Future integrations (Shopify, Square, MedusaJS) appear as "Coming Soon" tiles, building anticipation.

---

## Component Design

### 1. Integrations Framework (`src/lib/integrations/`)

A lightweight adapter pattern that all integrations implement:

```
src/lib/integrations/
  types.ts              # Common integration interfaces
  registry.ts           # Integration registry (discovers available integrations)
  stripe/
    index.ts            # Stripe adapter implementing IntegrationAdapter
    invoice.ts          # Invoice creation from claims/buyer rollup
    webhook.ts          # Stripe webhook handler (payment events)
    types.ts            # Stripe-specific types
```

#### Core Interface

```typescript
type IntegrationProvider = 'stripe' | 'shopify' | 'square' | 'medusajs';

type IntegrationConfig = {
  id: string;
  workspaceId: string;
  provider: IntegrationProvider;
  status: 'active' | 'inactive' | 'error';
  credentials: Record<string, string>;  // encrypted at rest
  settings: Record<string, unknown>;     // provider-specific config
  createdAt: Date;
  updatedAt: Date;
};

type IntegrationAdapter = {
  provider: IntegrationProvider;
  displayName: string;
  description: string;
  icon: string;

  // Lifecycle
  validateCredentials(credentials: Record<string, string>): Promise<boolean>;
  testConnection(config: IntegrationConfig): Promise<{ ok: boolean; error?: string }>;

  // Invoice/checkout operations (optional — not all integrations do invoicing)
  createInvoice?(params: InvoiceParams): Promise<InvoiceResult>;
  getInvoiceStatus?(invoiceId: string): Promise<InvoiceStatus>;
};
```

### 2. Database Changes

#### New Table: `integrations`

```
integrations
  id                UUID PK
  workspace_id      UUID FK → workspaces
  provider          integration_provider_enum ('stripe', 'shopify', 'square', 'medusajs')
  status            integration_status_enum ('active', 'inactive', 'error')
  display_name      varchar(255)          -- e.g. "My Stripe Account"
  credentials_enc   text                  -- AES-256-GCM encrypted JSON blob
  settings          JSONB                 -- provider-specific settings
  connected_at      timestamp
  created_at        timestamp
  updated_at        timestamp

  UNIQUE(workspace_id, provider)          -- one integration per provider per workspace
```

#### New Table: `invoices`

```
invoices
  id                UUID PK
  workspace_id      UUID FK → workspaces
  show_id           UUID FK → shows
  integration_id    UUID FK → integrations
  provider          integration_provider_enum
  external_id       varchar(255)          -- Stripe invoice ID, etc.
  external_url      text                  -- Hosted invoice/checkout URL
  buyer_handle      varchar(255)          -- Platform username
  buyer_platform_id varchar(255)          -- Platform user ID
  status            invoice_status_enum ('draft', 'sent', 'paid', 'void', 'error')
  amount_cents      integer               -- Total amount in cents
  currency          varchar(3)            -- e.g. 'usd'
  line_items        JSONB                 -- Snapshot of items at invoice time
  error_message     text                  -- If status = error
  sent_at           timestamp             -- When checkout link was sent
  paid_at           timestamp             -- When payment completed
  created_at        timestamp
  updated_at        timestamp

  INDEX(show_id, status)
  INDEX(workspace_id, created_at)
  INDEX(external_id)
```

### 3. Stripe Integration Specifics

#### Connection Methods

Two ways to connect Stripe (operator's choice):

1. **Stripe Connect (OAuth)** — Operator clicks "Connect with Stripe", goes through Stripe OAuth. We get a `stripe_user_id` and refresh token. Best for multi-tenant SaaS.
2. **API Keys (BYOK)** — Operator pastes their own Stripe Secret Key + Publishable Key. Simpler for single-operator setups.

Both methods store credentials encrypted using the existing AES-256-GCM system.

#### Invoice Creation Flow

```
Show Ends (or operator clicks "Generate Invoices")
  │
  ▼
Buyer Rollup Query
  │  Groups claims by (show_id, platform_user_id)
  │  Returns: buyer_handle, items[], quantities
  │
  ▼
For each buyer:
  │
  ├─ Create Stripe Invoice
  │    - Customer: lookup or create by buyer_handle
  │    - Line items: one per claimed item (number, title, price if set)
  │    - Memo: "Your claims from [Show Name]"
  │    - Auto-finalize = true (sends to customer if email set)
  │
  ├─ Store invoice record in our DB
  │
  └─ Send checkout link via FB private message (DM)
       - Uses Facebook Pages API: POST /{page-id}/messages
       - Template: "Hi {name}! Here's your checkout for [Show Name]: {url}"
       - Requires `pages_messaging` permission (App Review)
       - Falls back to: show URL in operator console for manual sharing
```

#### Stripe Webhook Handler

Listen for Stripe webhook events to update invoice status:

- `invoice.paid` → update invoice status to 'paid', emit WebSocket event
- `invoice.payment_failed` → update to 'error', notify operator
- `invoice.voided` → update to 'void'

### 4. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/integrations` | List all available integrations + connection status |
| POST | `/api/integrations/stripe/connect` | Connect Stripe (BYOK or start OAuth) |
| GET | `/api/integrations/stripe/oauth/callback` | Stripe OAuth callback |
| DELETE | `/api/integrations/stripe` | Disconnect Stripe |
| GET | `/api/integrations/stripe/test` | Test Stripe connection health |
| POST | `/api/shows/:id/invoices/generate` | Generate invoices for a show's buyers |
| GET | `/api/shows/:id/invoices` | List invoices for a show |
| POST | `/api/shows/:id/invoices/:invoiceId/send` | Send/re-send checkout link |
| POST | `/api/webhooks/stripe` | Stripe webhook receiver |

### 5. UI Components

#### Integrations Hub Page (`/integrations`)

```
┌─────────────────────────────────────────────┐
│  Integrations                                │
│  Connect third-party services to enhance     │
│  your live selling workflow.                 │
│                                              │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  [Stripe]    │  │  [Shopify]   │         │
│  │  ✅ Connected │  │  Coming Soon │         │
│  │  [Manage]    │  │              │         │
│  └──────────────┘  └──────────────┘         │
│  ┌──────────────┐  ┌──────────────┐         │
│  │  [Square]    │  │  [MedusaJS]  │         │
│  │  Coming Soon │  │  Coming Soon │         │
│  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────┘
```

#### Stripe Connection Page (`/integrations/stripe`)

- Connection method selector (OAuth vs BYOK)
- API key input fields (for BYOK)
- Connection status indicator
- Test connection button
- Default invoice settings (currency, memo template)
- Disconnect button

#### Invoice Panel (Show Detail / Summary Page)

After a show ends, a new "Invoices" tab appears:
- Buyer list with invoice status per buyer
- "Generate All Invoices" button
- Per-buyer: "Generate", "Send Link", "View on Stripe" actions
- Status badges: Draft, Sent, Paid, Error

### 6. Isolation Strategy

Since another developer is working on the live sale experience, this feature is designed for **maximum isolation**:

**New directories only (no conflicts):**
- `src/lib/integrations/` — entirely new
- `src/app/(dashboard)/integrations/` — new pages
- `src/app/api/integrations/` — new API routes
- `src/app/api/webhooks/stripe/` — new webhook route
- `src/components/integrations/` — new components
- `drizzle/` — new migration files (additive only)

**Minimal touches to existing files:**
- `src/lib/db/schema.ts` — ADD new tables + enums (append only, no modifications to existing tables)
- `src/app/(dashboard)/layout.tsx` — ADD one nav item to the array
- `src/app/api/shows/[id]/invoices/` — new directory under existing shows API

**Zero changes to:**
- Claim engine (`src/lib/claim-engine/`)
- Console components (`src/components/console/`)
- WebSocket server (`src/lib/realtime/`)
- Platform adapters (`src/lib/platforms/`)
- Auth system (`src/lib/auth/`)
- Existing show pages/routes

---

## Sequence Diagram: Invoice Generation

```
Operator                 App Server              Stripe API           Facebook API
   │                        │                       │                      │
   │  POST /shows/:id/      │                       │                      │
   │   invoices/generate     │                       │                      │
   │───────────────────────►│                       │                      │
   │                        │                       │                      │
   │                        │  Query buyer rollup    │                      │
   │                        │  (claims grouped by    │                      │
   │                        │   platform_user_id)    │                      │
   │                        │                       │                      │
   │                        │  For each buyer:       │                      │
   │                        │─────────────────────►│                      │
   │                        │  Create Invoice +      │                      │
   │                        │  Line Items            │                      │
   │                        │◄─────────────────────│                      │
   │                        │  invoice.id +          │                      │
   │                        │  hosted_invoice_url    │                      │
   │                        │                       │                      │
   │                        │  Store invoice record   │                      │
   │                        │                       │                      │
   │                        │  (optional) Send DM ───────────────────────►│
   │                        │  with checkout URL      │                      │
   │                        │◄──────────────────────────────────────────│
   │                        │                       │                      │
   │◄──────────────────────│                       │                      │
   │  { invoices: [...] }   │                       │                      │
   │                        │                       │                      │
   │         ─── later ───  │                       │                      │
   │                        │◄─────────────────────│                      │
   │                        │  webhook: invoice.paid │                      │
   │                        │                       │                      │
   │  WS: invoice.paid      │                       │                      │
   │◄──────────────────────│                       │                      │
```

---

## Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stripe SDK | `stripe` npm package | Official SDK, typed, well-maintained |
| Credential storage | Reuse existing AES-256-GCM encryption | Consistency, already proven |
| Invoice model | Our own `invoices` table + Stripe as source of truth | Allows offline access, status tracking, supports future non-Stripe providers |
| DM delivery | Facebook Pages Messaging API | Direct path to buyer. Falls back to operator-visible URL if messaging permissions unavailable |
| Item pricing | Optional per-item price on `show_items` | Allows invoice line items to have amounts. Default to $0 (operator fills in on Stripe) if no price set |
| Webhook verification | Stripe signature verification (`stripe.webhooks.constructEvent`) | Security best practice |
| Tier gating | `workspace.settings.plan` field + middleware check | Simple MVP approach, upgrade to proper billing later |

---

## New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `stripe` | `^17.x` | Stripe API SDK |

---

## Environment Variables (New)

```
# Stripe (for OAuth flow — only needed if using Stripe Connect)
STRIPE_CLIENT_ID=<from-stripe-dashboard>
STRIPE_WEBHOOK_SECRET=<from-stripe-dashboard>

# Note: Individual workspace Stripe keys are stored encrypted in the integrations table
```
