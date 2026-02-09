# Live Sale Listener — Product Requirements Document

**Facebook Live + Instagram Live Comment-to-Claim Engine**
**MVP Specification for Agent Build**

| Field | Value |
|-------|-------|
| Document Version | 2.0 — Refined for Agent Build |
| Date | February 2026 |
| Author | Jesse / Opterra Systems |
| Status | Ready for Development |
| Target Stack | Node.js/TypeScript, Next.js, PostgreSQL, WebSockets |

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Goals & Success Metrics](#2-goals--success-metrics)
3. [Non-Goals (MVP)](#3-non-goals-mvp)
4. [Target Users & Personas](#4-target-users--personas)
5. [User Flows](#5-user-flows)
6. [Functional Requirements](#6-functional-requirements)
7. [Non-Functional Requirements](#7-non-functional-requirements)
8. [Data Model](#8-data-model)
9. [Service API](#9-service-api)
10. [Meta Platform Requirements & Approval Strategy](#10-meta-platform-requirements--approval-strategy)
11. [Technical Architecture](#11-technical-architecture)
12. [Build Plan & Milestones](#12-build-plan--milestones)
13. [Testing Strategy](#13-testing-strategy)
14. [Risks & Mitigations](#14-risks--mitigations)
15. [Post-MVP Roadmap](#15-post-mvp-roadmap)
16. [Appendix](#16-appendix)

---

## 1. Executive Summary

Live Sale Listener is a web application that enables live-stream sellers on Facebook and Instagram to automate the comment-to-claim process during live sales events. When a viewer comments a pattern like "sold 123" during a live broadcast, the system instantly detects the claim, assigns the item to the first valid claimant, manages a FIFO waitlist for subsequent claims, and presents all activity in a real-time operator console.

This product targets the same market as Loyal Shops Live Assistant, ReplySOLD, SoldLive, and CommentSold — platforms that have demonstrated strong product-market fit among boutique retailers, consignment shops, and direct sellers running Facebook Live sales. The MVP focuses on the core claim engine and operator experience, with a clear path toward checkout integrations (Shopify, MedusaJS, Square) in subsequent releases.

### 1.1 Competitive Positioning

Based on competitive analysis of Loyal Shops (Live Assistant + ReplySOLD), SoldLive, and CommentSold, this MVP is designed to match core functionality while establishing differentiation through:

- **Modern tech stack:** Built on Next.js and TypeScript for faster iteration and modern developer experience vs. legacy PHP/jQuery competitors.
- **Consignment-first design:** Optimized for Rock It Resell's use case — authenticated luxury consignment with multi-channel operations.
- **Open checkout architecture:** Pluggable adapter pattern for MedusaJS, Shopify, and Square rather than vendor lock-in.
- **AI-ready foundation:** Structured to integrate LLM-based comment parsing for fuzzy matching and multi-variant claims in post-MVP.

---

## 2. Goals & Success Metrics

| ID | Goal | Success Metric | Measurement |
|----|------|----------------|-------------|
| G1 | Rapid activation | Seller selects live and activates agent | < 30 seconds from login |
| G2 | High-precision claim detection | Correctly parse SOLD intent from comments | > 99% precision on standard patterns |
| G3 | Fair allocation with waitlist | First claimant wins, FIFO waitlist for rest | Zero allocation errors under load |
| G4 | Real-time operator visibility | UI updates reflect claims as they arrive | < 3 seconds comment-to-UI latency |
| G5 | Dual-platform support | Works end-to-end on FB Live and IG Live | Both platforms tested with real broadcasts |
| G6 | Quantity support (1–30) | Multiple units of same item claimable | Quantity tracking accurate to unit level |
| G7 | Pass/release workflow | Operator or viewer can release a claim | Waitlist auto-promotes correctly |

---

## 3. Non-Goals (MVP)

The following are explicitly excluded from the MVP to maintain focus and achievable timelines:

- Payments, shipping labels, fulfillment processing, or any checkout flow
- Complex multi-variant parsing (e.g., "sold 123 blue small") — deferred to post-MVP with AI parser
- Claim ranges (e.g., "sold 100–110")
- Multi-tenant agency features beyond basic workspace/account model
- Automated public comment replies or DM-based cart delivery (post-MVP feature)
- TikTok Live integration (CommentSold differentiator, evaluate post-MVP)
- Mobile app or live overlay (SoldLive/CommentSold feature, evaluate post-MVP)
- Barcode/SKU scanning for item loading (ReplySOLD feature, post-MVP)
- 24/7 post-live monitoring of past videos for late claims (ReplySOLD feature, post-MVP)
- Customer registration or loyalty programs

---

## 4. Target Users & Personas

### 4.1 Primary: Operator (Seller/Host)

The person running the live sale. They go live on Facebook or Instagram, present items to viewers, and need instant, automated claim tracking so they can focus on selling and entertaining rather than manually scanning comments.

**Key needs:** Start quickly, trust the system to catch every claim, see who claimed what at a glance, resolve disputes, export results for invoicing.

### 4.2 Secondary: Assistant / Admin

A helper who watches the operator console during the live, monitors claims, resolves disputes (mark pass, release items, manual award), and handles post-show invoicing/summary.

**Key needs:** Full visibility into claim feed, ability to search/filter comments, override allocations, export data.

### 4.3 Tertiary: Viewer (Buyer)

The live viewer who comments "sold 123" to claim an item. In MVP, their experience is the native Facebook/Instagram comment flow — the system does not reply to them directly. Post-MVP will add automated acknowledgment replies and DM-based cart delivery.

---

## 5. User Flows

### 5.1 Flow A: Self-Serve Onboarding

1. User signs up (email/password or magic link) and creates a workspace.
2. Navigate to Settings > Connections.
3. Click "Connect Facebook Page" — initiates Meta OAuth flow requesting `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata` permissions.
4. Click "Connect Instagram Account" — initiates Meta OAuth for `instagram_basic`, `instagram_manage_comments`, `pages_show_list`.
5. Upon successful OAuth, connection appears with status indicator, display name, and token health.

### 5.2 Flow B: Create & Start a Show

1. Click "New Show" from dashboard.
2. Enter show name (optional), select platform (Facebook or Instagram), select connected account.
3. Add items: manual entry of item numbers (quick-add input), optional title/description, set quantity (1–30, default 1).
4. Click "Detect Active Lives" — system queries platform API for currently broadcasting lives.
5. Select the target live broadcast from the list.
6. Click "Activate Agent" — system begins polling/webhook ingestion. Console shows "Listening…" with live status indicator.

### 5.3 Flow C: Claim Handling During Live

This is the core runtime loop:

1. Viewer comments "sold 123" (or "123 sold") on the live broadcast.
2. System ingests comment via polling (FB) or webhook (IG).
3. Claim parser extracts intent: `item_number=123`, `user=@viewername`.
4. Allocation engine checks item status within a database transaction.
5. If first valid claim and quantity available: mark as winner, decrement available quantity.
6. If item fully claimed: add to waitlist at next FIFO position.
7. If duplicate claim (same user + same item): ignore silently.
8. Emit real-time event via WebSocket: `claim.created`, `item.updated`.
9. Operator UI updates instantly: items list shows claimed state, claim feed appends entry, item detail drawer shows winner + waitlist.

### 5.4 Flow D: Pass / Release

1. Viewer comments "pass 123" (or operator clicks Release on a claim in the UI).
2. System releases the claim for that user on that item.
3. If waitlist exists: auto-promote next waitlisted user to winner, emit events.
4. If no waitlist: item returns to unclaimed/available state.

### 5.5 Flow E: End Show & Summary

1. Operator clicks "Stop Show" — system halts ingestion.
2. Summary view displays: total items claimed, total unique buyers, per-item breakdown (winner + waitlist).
3. Buyer rollup view: grouped by buyer, showing all items claimed.
4. Export to CSV: full claim log and buyer rollup.

---

## 6. Functional Requirements

### 6.1 Claim Parser Engine

#### FR1: Comment Normalization

Every incoming comment must be normalized before pattern matching:

- Convert to lowercase
- Trim leading/trailing whitespace
- Remove all punctuation except digits and letters
- Collapse multiple spaces to single space
- Strip emoji and special unicode characters

#### FR2: Pattern Recognition

The parser must recognize the following claim patterns and extract the item number:

| Pattern | Regex | Example | Priority |
|---------|-------|---------|----------|
| SOLD + number | `sold\s+(\d+)` | sold 123 | Required |
| Number + SOLD | `(\d+)\s+sold` | 123 sold | Required |
| SOLD + number (no space) | `sold(\d+)` | sold123 | Required |
| PASS + number | `pass\s+(\d+)` | pass 123 | Required |
| Number + PASS | `(\d+)\s+pass` | 123 pass | Required |

#### FR3: Claim Intent Output

The parser produces one of:

- **ClaimIntent:** `{ type: 'claim', itemNumber: string, rawText: string }`
- **PassIntent:** `{ type: 'pass', itemNumber: string, rawText: string }`
- **Ignore:** Comment does not match any recognized pattern

#### FR4: Configurable Claim Word

The default trigger word is "sold" but must be configurable per workspace. Common alternatives include "mine", "claim", "buy", or custom words. The pass word should also be configurable (default: "pass").

### 6.2 Allocation Engine

#### FR5: Transactional Allocation

All allocation decisions must execute within a database transaction using row-level locking (`SELECT ... FOR UPDATE`) to prevent race conditions:

- Check if item exists in the active show
- Check available quantity (`total_quantity - claimed_count`)
- If available > 0: create claim record with `status=winner`, decrement available
- If available = 0: create claim record with `status=waitlist`, assign next position

#### FR6: Deduplication

- Same user claiming same item multiple times: only first claim counts, subsequent ignored
- Same comment processed multiple times (polling overlap): idempotency key prevents duplicates

#### FR7: Waitlist Management

- Waitlist is strict FIFO ordered by claim timestamp
- When a winner passes or is released, the first waitlisted claimant auto-promotes to winner
- Promotion emits real-time events so the UI updates immediately

#### FR8: Quantity Support (1–30)

Each show item has a configurable quantity (default 1, max 30). When quantity > 1, multiple users can be winners up to the quantity limit. This matches the Loyal Shops feature of tracking per-customer claims across multi-quantity items.

### 6.3 Session Management

#### FR9: Show Lifecycle

A show progresses through these states:

- **draft:** Show created, items being added, no live selected yet
- **active:** Live selected and agent activated, comments being ingested
- **paused:** Ingestion temporarily halted (operator action), can resume
- **ended:** Show completed, no further ingestion, summary available

#### FR10: Session Binding

An active show is bound to exactly one live broadcast (FB `live_video_id` or IG `live_media_id`). Only comments from the bound live are processed. The system must reject or ignore comments from other sources.

### 6.4 Real-Time UI

#### FR11: WebSocket Event Channel

The server maintains a WebSocket connection per active show session. Events emitted:

| Event | Payload | Trigger |
|-------|---------|---------|
| `claim.created` | `{ claim, item, user }` | New claim processed |
| `claim.released` | `{ claim, item, promotedClaim? }` | Claim passed/released |
| `item.updated` | `{ item, winnersCount, waitlistCount }` | Any item state change |
| `session.status` | `{ showId, status, stats }` | Show state transition |
| `comment.received` | `{ comment, parsed: boolean }` | Any comment ingested |
| `error` | `{ code, message, context }` | Processing error |

#### FR12: Operator Console UI

The live console is the primary operator interface during a show. It must include:

**Items Panel (left):** Scrollable list of all show items. Each item shows: item number, title (if set), quantity (available/total), status badge (unclaimed/claimed/sold out), winner display name(s). Click to expand item detail drawer.

**Claim Feed (center):** Reverse-chronological feed of all claim events. Each entry shows: timestamp, @username, item number, status (winner/waitlist #N/duplicate/ignored). Color-coded by status. Searchable and filterable.

**Live Comments (right):** Full comment stream from the live broadcast (not just claims). Searchable. This mirrors the Loyal Shops "LIVE Commenting" feature that operators found invaluable for assistants to track the full conversation.

**Status Bar (top):** Show name, live status indicator, elapsed time clock, items claimed / total, unique buyers count.

**Item Detail Drawer:** Expandable panel showing: winner(s) with username and timestamp, ordered waitlist with position numbers, action buttons (Release, Pass, Manual Award).

### 6.5 Platform Integration

#### 6.5.1 Facebook Live

**Live Discovery:** Query `/{page-id}/live_videos` to list active broadcasts for the connected Page. Display broadcast title, start time, viewer count (if available).

**Comment Ingestion (Polling):** Poll `/{live-video-id}/comments` at a configurable interval (default: 2 seconds). Use reverse chronological ordering. Track `last_seen_comment_id` to avoid reprocessing. Implement exponential backoff on rate limit responses (HTTP 429).

**Comment Reply (Post-MVP):** POST to `/{comment-id}/comments` or `/{live-video-id}/comments` to acknowledge claims. MVP will prepare the reply text but not send it automatically.

**Permissions Required:** `pages_show_list`, `pages_read_engagement`, `pages_read_user_content`. Note: `pages_read_user_content` may require App Review for production; in development mode, the Page admin's own test data is accessible.

**Fallback Path:** If live discovery fails, operator can paste a Live Video URL or ID directly.

#### 6.5.2 Instagram Live

**Live Discovery:** Query `/{ig-user-id}/live_media` to list currently broadcasting live media for the connected IG Professional account.

**Comment Ingestion (Webhooks):** Subscribe to Instagram Webhooks field `live_comments`. Implement webhook endpoint with GET verification handshake and POST event processing with HMAC signature verification.

**Critical Constraint:** Advanced Access / App Review is required to receive webhooks for `live_comments`. This means IG Live end-to-end testing requires approved app status. Plan to submit for App Review early and use simulated events during development.

**IG-Specific Limitation:** Instagram API only allows reading comments on live media, not replying. This means automated acknowledgment replies are not possible on IG Live (only FB Live post-MVP).

**Permissions Required:** `instagram_basic`, `instagram_manage_comments`, `pages_show_list`. App Review required for Advanced Access.

### 6.6 Operator Actions

| Action | Description | Effect |
|--------|-------------|--------|
| Release Claim | Remove a winner's claim on an item | Promotes next waitlisted user or frees item |
| Manual Award | Manually assign item to a user handle | Creates claim record with operator attribution |
| Add Item (live) | Add new item number during broadcast | Item appears in items panel immediately |
| Update Quantity | Change item quantity during broadcast | Adjusts available count, may promote waitlist |
| Pause Ingestion | Temporarily stop processing comments | Show enters paused state, no claims processed |
| Resume | Resume after pause | Re-enables comment processing from current point |
| Export CSV | Download claims data | Full claim log + buyer rollup as CSV files |

---

## 7. Non-Functional Requirements

| ID | Category | Requirement | Target |
|----|----------|-------------|--------|
| NFR1 | Latency | Comment arrival to UI update | < 3 seconds end-to-end |
| NFR2 | Reliability | Tolerate duplicates, retries, out-of-order delivery | Zero data loss under normal ops |
| NFR3 | Idempotency | Comment events processed exactly-once logically | Idempotency key on every claim |
| NFR4 | Security | Encrypt tokens at rest, least privilege, audit logs | AES-256 for tokens, RBAC |
| NFR5 | Rate Limits | Paced polling, backoff for Graph API | Stay within 200 calls/user/hour |
| NFR6 | Scalability | Support up to 50 concurrent viewers commenting | Handle 10 comments/second peak |
| NFR7 | Availability | System accessible during scheduled live events | 99.5% uptime during shows |
| NFR8 | Data Retention | Store show data for export and review | 90 days minimum retention |

---

## 8. Data Model

PostgreSQL is the recommended database. All tables use UUID primary keys and include `created_at`/`updated_at` timestamps.

### 8.1 Entity Relationship Summary

#### `workspaces`

```
id, owner_user_id, name, settings (JSONB), created_at, updated_at
```

Top-level tenant container.

#### `users`

```
id, email, password_hash, name, created_at
```

Operator/admin accounts.

#### `social_connections`

```
id, workspace_id, platform (facebook|instagram), external_account_id, display_name,
encrypted_access_token, token_expires_at, refresh_token_encrypted, scopes[],
status (active|expired|revoked), created_at, updated_at
```

OAuth connections to Meta platforms.

#### `shows`

```
id, workspace_id, name, status (draft|active|paused|ended), platform, connection_id,
live_id, live_url, claim_word (default: 'sold'), pass_word (default: 'pass'),
started_at, ended_at, created_at, updated_at
```

A live sale session.

#### `show_items`

```
id, show_id, item_number (varchar), title, description,
total_quantity (default 1, max 30), claimed_count (default 0),
status (unclaimed|partial|claimed|sold_out), created_at, updated_at
```

Items available in a show.

#### `claims`

```
id, show_id, show_item_id, item_number, platform, live_id,
platform_user_id, user_handle, user_display_name,
comment_id, raw_text, normalized_text,
claim_type (claim|pass), claim_status (winner|waitlist|released|passed),
waitlist_position, idempotency_key (unique),
operator_action (boolean), operator_notes,
created_at, updated_at
```

Individual claim records.

#### `comments`

```
id, show_id, live_id, platform, platform_user_id, user_handle,
comment_id, raw_text, normalized_text, parsed (boolean),
claim_id (FK, nullable), received_at, created_at
```

Full comment log for search/display.

#### `audit_log`

```
id, workspace_id, show_id, actor_user_id, action, entity_type,
entity_id, details (JSONB), created_at
```

Operator action audit trail.

### 8.2 Idempotency Strategy

Every claim must have a unique `idempotency_key` to prevent duplicate processing:

- **Primary (when comment_id available):** `hash(platform + comment_id)`
- **Fallback (webhook without comment_id):** `hash(platform + live_id + platform_user_id + normalized_text + timestamp_bucket_10s)`

The `idempotency_key` column has a UNIQUE constraint. On conflict, the insertion is skipped silently.

### 8.3 Indexes

- `claims`: `(show_id, item_number, claim_status)` for allocation lookups
- `claims`: `(show_id, platform_user_id, item_number)` for deduplication checks
- `claims`: `(idempotency_key)` UNIQUE for upsert
- `comments`: `(show_id, received_at)` for chronological feed
- `show_items`: `(show_id, item_number)` UNIQUE for item lookups
- `shows`: `(workspace_id, status)` for active show queries

### 8.4 Views

**buyer_rollups:** Materialized view or query that aggregates claims by `(show_id, platform_user_id)` to produce per-buyer item lists for invoicing/export.

---

## 9. Service API

REST API endpoints supporting the frontend and platform connectors. All endpoints require authentication except webhooks.

### 9.1 Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account (email + password) |
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/refresh` | Refresh JWT token |
| GET | `/api/auth/me` | Current user profile |

### 9.2 Social Connections

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/connections` | List all connections for workspace |
| POST | `/api/connections/oauth/:platform/start` | Initiate Meta OAuth redirect |
| GET | `/api/connections/oauth/:platform/callback` | Handle OAuth callback, store tokens |
| DELETE | `/api/connections/:id` | Disconnect and revoke tokens |
| GET | `/api/connections/:id/lives` | List active lives for connection |

### 9.3 Shows

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shows` | Create new show |
| GET | `/api/shows` | List shows for workspace |
| GET | `/api/shows/:id` | Show details with items and stats |
| PATCH | `/api/shows/:id` | Update show metadata |
| POST | `/api/shows/:id/items` | Add item(s) to show |
| PATCH | `/api/shows/:id/items/:itemId` | Update item (quantity, title) |
| DELETE | `/api/shows/:id/items/:itemId` | Remove item (only if unclaimed) |
| POST | `/api/shows/:id/activate` | Activate agent with live_id |
| POST | `/api/shows/:id/pause` | Pause ingestion |
| POST | `/api/shows/:id/resume` | Resume ingestion |
| POST | `/api/shows/:id/stop` | End show |
| GET | `/api/shows/:id/claims` | List claims (filterable) |
| GET | `/api/shows/:id/buyers` | Buyer rollup view |
| GET | `/api/shows/:id/comments` | Full comment log |
| GET | `/api/shows/:id/export` | CSV export |

### 9.4 Operator Actions

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/claims/:id/release` | Release/pass a claim |
| POST | `/api/shows/:id/items/:itemId/award` | Manually award item to user |

### 9.5 Webhooks & Ingestion

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/webhooks/instagram` | Meta webhook verification + events |
| POST | `/api/debug/emit_comment` | Dev-only: simulate comment event |
| POST | `/api/debug/emit_ig_webhook` | Dev-only: simulate IG webhook payload |

### 9.6 WebSocket

**Endpoint:** `WS /api/realtime?show_id={showId}&token={jwt}`

Clients subscribe to a show's event stream. The server pushes events as they occur. Heartbeat ping/pong at 30-second intervals to detect stale connections.

---

## 10. Meta Platform Requirements & Approval Strategy

### 10.1 Meta App Configuration

Create a single Meta App that covers both Facebook and Instagram:

- App Type: Business
- Products to enable: Facebook Login, Instagram Basic Display (or Instagram Graph API), Webhooks
- Privacy Policy URL and Terms of Service URL required for app review submission

### 10.2 Permission Matrix

| Permission | Platform | Purpose | App Review? |
|------------|----------|---------|-------------|
| `pages_show_list` | Facebook | List connected pages | Standard Access OK |
| `pages_read_engagement` | Facebook | Read live video comments | Standard Access OK* |
| `pages_read_user_content` | Facebook | Read user comments on page content | App Review required |
| `pages_manage_metadata` | Facebook | Subscribe page to webhooks | App Review required |
| `instagram_basic` | Instagram | Read IG profile | Standard Access OK |
| `instagram_manage_comments` | Instagram | Read/manage IG comments | App Review required |
| `pages_show_list` | Instagram | Access IG via connected page | Standard Access OK |

\* In development mode, Standard Access permissions work for assets owned by app admins/testers.

### 10.3 Practical Development Strategy

The approval timeline creates a natural phasing:

**Phase 1 (Immediate):** Build and validate everything with simulated events via the debug harness. No Meta permissions needed.

**Phase 2 (Dev Mode):** Connect a test Facebook Page that you admin. In development mode, you can poll live video comments on your own Page without App Review.

**Phase 3 (App Review):** Submit for App Review with screencasts demonstrating the live sales use case. Required for: IG Live webhooks, reading comments from non-admin pages, and production deployment.

**Phase 4 (Production):** After approval, enable Instagram Live webhooks and open to external users.

---

## 11. Technical Architecture

### 11.1 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14+ (App Router), React, Tailwind CSS | SSR + SPA, rapid UI development |
| Backend API | Next.js API Routes or standalone Express/Fastify | Unified deployment, TypeScript |
| Database | PostgreSQL 15+ | ACID transactions, row locks, JSONB |
| ORM | Prisma or Drizzle ORM | Type-safe queries, migrations |
| Real-time | WebSocket (ws library) or Socket.io | Bi-directional real-time events |
| Auth | NextAuth.js or custom JWT | OAuth provider support built-in |
| Token Encryption | Node.js crypto (AES-256-GCM) | Encrypt Meta tokens at rest |
| Task Queue | BullMQ + Redis (or in-process for MVP) | Polling workers, retry logic |
| Deployment | Vercel / Railway / Docker | Simple deployment, managed infra |
| Tunnel (Dev) | ngrok or cloudflared | Webhook endpoint for local dev |

### 11.2 System Architecture Overview

The system follows a three-tier architecture with clear separation between ingestion, processing, and presentation:

**Ingestion Layer:** Platform-specific adapters that normalize comments from Facebook (polling) and Instagram (webhooks) into a common `CommentEvent` format. Each adapter handles rate limiting, deduplication at the transport level, and platform-specific authentication.

**Processing Layer:** The Claim Engine receives normalized `CommentEvent`s, runs them through the parser, and executes allocation logic within database transactions. This layer is platform-agnostic and testable independently.

**Presentation Layer:** Next.js frontend with WebSocket connection for real-time updates. The API layer serves both the frontend and any future integrations (mobile app, checkout adapters).

### 11.3 Key Design Decisions

**Polling vs. Webhooks for Facebook:** MVP uses polling for Facebook Live comments. While webhooks are more efficient, they require additional App Review permissions and introduce complexity around webhook reliability. Polling at 2-second intervals provides sub-3-second latency which meets our G4 goal. The polling worker should be implemented as a BullMQ repeatable job for reliability.

**Webhooks for Instagram:** Instagram Live comment access requires webhooks (polling is not supported for `live_comments`). This means IG functionality is gated on App Review approval.

**Database Transactions for Allocation:** Using `SELECT ... FOR UPDATE` on the `show_items` row ensures atomic allocation even under concurrent claim pressure. This is simpler and more reliable than optimistic concurrency for MVP scale.

---

## 12. Build Plan & Milestones

Target: 18 working days for full MVP. Each milestone has clear deliverables, tasks, and acceptance criteria.

### Milestone 0: Project Scaffold (Days 1–2)

**Deliverables:**

- Monorepo with Next.js app, TypeScript configured, ESLint + Prettier
- PostgreSQL schema + initial migration (all tables from Section 8)
- Prisma/Drizzle ORM setup with typed models
- Auth system: registration, login, JWT issuance
- Base UI shell: layout, navigation (Dashboard, Shows, Connections, Settings)
- CI pipeline: lint, type-check, test runner

**Acceptance Criteria:**

- User can register, login, and see the dashboard
- Database migrations run cleanly
- All models are typed and queryable via ORM

### Milestone 1: Core Claim Engine + Real-Time UI (Days 3–6)

**Deliverables:**

- Claim parser with full pattern recognition (FR1–FR4)
- Allocation engine with transactional logic (FR5–FR8)
- WebSocket server for show events (FR11)
- Live Console UI with all panels (FR12)
- Debug endpoints for simulating comments

**Acceptance Criteria:**

- POST to `/api/debug/emit_comment` with "sold 123" creates a winner claim
- Second user claiming same item goes to waitlist
- Duplicate claims from same user are ignored
- Pass/release promotes waitlist correctly
- All events appear in real-time on the UI via WebSocket
- Load test: 1,000 synthetic comments processed correctly with no duplicates or ordering errors

### Milestone 2: Meta OAuth + Social Connections (Days 7–9)

**Deliverables:**

- Meta App created in developer console
- "Connect Facebook Page" OAuth flow
- "Connect Instagram Account" OAuth flow
- Encrypted token storage (AES-256-GCM)
- Connection management UI (list, status, disconnect)
- Token refresh logic for long-lived tokens

**Acceptance Criteria:**

- Successfully connect a test Facebook Page and see it listed
- Successfully connect a test IG Professional account
- Tokens stored encrypted, decrypted only when needed for API calls
- Token expiration handled gracefully with user notification

### Milestone 3: Facebook Live Integration (Days 10–12)

**Deliverables:**

- "Detect Active Lives" for connected Facebook Pages
- Polling worker for live video comments
- Full end-to-end flow: Go Live → Detect → Activate → Claim → UI Update
- Rate limit handling with exponential backoff
- Fallback: paste Live Video URL/ID manually

**Acceptance Criteria:**

- Start a real Facebook Live on test Page
- Live appears in "Detect Active Lives" list in UI
- Activate agent, comment "sold 123" from 2–3 different accounts
- Winner + waitlist + UI updates all work correctly
- No duplicate claims from polling overlap
- Polling stops cleanly when show is stopped

### Milestone 4: Instagram Live Integration (Days 13–15, approval-dependent)

**Deliverables:**

- IG Live discovery via `/{ig-user-id}/live_media`
- Webhook endpoint with verification handshake
- `live_comments` webhook subscription and processing
- Session filter: only process events matching active `live_media_id`

**Acceptance Criteria (pre-approval):**

- Webhook endpoint passes Meta's verification challenge
- Simulated IG webhook payloads processed correctly by claim engine
- HMAC signature verification working

**Acceptance Criteria (post-approval):**

- Real IG Live broadcast detected in discovery
- `live_comments` events received and processed during broadcast
- Claims from IG Live appear in same UI as FB Live claims

### Milestone 5: Hardening, Polish & Export (Days 16–18)

**Deliverables:**

- Show summary page with stats and buyer rollups
- CSV export for claims and buyer rollups
- Settings page: claim word configuration, workspace preferences
- Error handling and edge case coverage
- Observability: structured logging, error tracking
- Audit log for all operator actions
- Performance optimization: query tuning, WebSocket connection management

**Acceptance Criteria:**

- Complete show lifecycle tested end-to-end on both platforms
- CSV export produces valid, importable data
- System handles network interruptions gracefully (polling resumes, WebSocket reconnects)
- Audit log captures all operator actions with timestamps

---

## 13. Testing Strategy

### 13.1 Development Harness

The debug endpoints are critical for rapid development and should be the first testing surface:

**`POST /api/debug/emit_comment`:** Accepts `{ showId, userId, userHandle, text, timestamp? }`. Bypasses platform ingestion and feeds directly into the claim engine. Essential for unit and integration testing without any Meta API dependency.

**`POST /api/debug/emit_ig_webhook`:** Simulates the exact payload format that Instagram's webhook would deliver. Used to validate the full IG processing pipeline before App Review approval.

**`POST /api/debug/bulk_comments`:** Accepts an array of comments with configurable delays between them. Used for load testing and race condition validation.

### 13.2 Test Categories

#### Unit Tests

- Claim parser: all pattern variations, edge cases (empty strings, only digits, mixed text)
- Normalization: punctuation removal, emoji stripping, case folding
- Idempotency key generation: consistency across inputs

#### Integration Tests

- Allocation engine: concurrent claims via debug endpoint, verify transactional safety
- Waitlist promotion: release winner, verify next-in-line promoted
- Quantity management: claim up to quantity, verify sold-out + waitlist behavior
- WebSocket: connect, receive events, verify payload format

#### End-to-End Tests

- Facebook Live: real broadcast on test Page, comment from multiple accounts, verify full pipeline
- Instagram Live: simulated webhooks (pre-approval), real broadcast (post-approval)
- Show lifecycle: create → add items → activate → claims → pass → stop → export

#### Load Tests

- 1,000 comments in 60 seconds: verify ordering, deduplication, and UI responsiveness
- 50 concurrent WebSocket connections: verify event delivery to all clients
- Sustained polling at 2-second intervals for 60 minutes: verify no memory leaks or rate limit violations

---

## 14. Risks & Mitigations

| Risk | Severity | Mitigation | Contingency |
|------|----------|------------|-------------|
| Instagram App Review delay (weeks to months) | High | Submit App Review in Milestone 2. Ship FB-only MVP first. Use simulated IG mode. | Launch as Facebook-only product initially, add IG when approved |
| Meta API deprecation or permission changes | Medium | Pin to specific Graph API version (v22.0). Monitor changelog. Abstract platform calls behind adapters. | Adapter pattern allows swapping implementation without core changes |
| Event duplication from polling overlap | Medium | Strict idempotency keys. UNIQUE constraint on `claims.idempotency_key`. `ON CONFLICT DO NOTHING`. | Audit log allows manual cleanup if needed |
| Rate limiting on FB Graph API | Medium | Paced polling (2s interval), exponential backoff on 429, reverse chronological fetch with cursor. | Increase polling interval dynamically; cache recent results |
| Identity mapping (usernames vary, may be missing) | Low | Store `platform_user_id` as primary identifier. `user_handle` is best-effort display. | Manual operator override for identity disputes |
| WebSocket connection drops during live | Medium | Automatic reconnect with exponential backoff. Missed events fetched via REST on reconnect. | Full claim state available via `GET /shows/:id/claims` |
| Concurrent claim race conditions | High | `SELECT ... FOR UPDATE` row locking in PostgreSQL transaction. | Database-level guarantee, tested under load |

---

## 15. Post-MVP Roadmap

Features prioritized based on competitive analysis of Loyal Shops, ReplySOLD, SoldLive, and CommentSold:

### Phase 2: Automated Acknowledgment & Cart Delivery

- Auto-reply to claim comments on Facebook ("@user, you claimed item #123!")
- Facebook Messenger cart delivery (like ReplySOLD's Shopify cart-in-Messenger flow)
- Customizable response templates per workspace (Loyal Shops feature)

### Phase 3: Checkout Integrations

- MedusaJS adapter: create draft orders from claim data (leveraging existing MedusaJS plugin work)
- Shopify adapter: create Shopify draft orders/carts from claims (SoldLive/ReplySOLD parity)
- Square adapter: invoice generation from claims (Loyal Shops parity)
- Cart expiration and abandon cart reminders (ReplySOLD feature)

### Phase 4: Advanced Claim Parsing

- Multi-variant claims: "sold 123 blue medium" using AI/LLM parser
- Claim ranges: "sold 100–110" bulk claims
- Fuzzy matching for typos and creative comment formats
- Configurable claim keywords beyond sold/pass

### Phase 5: Enhanced Operator Experience

- Barcode/SKU scanning for item loading (ReplySOLD feature)
- Live video overlay with product details and purchase instructions (CommentSold/SoldLive feature)
- 24/7 post-live monitoring: continue watching past videos for late claims (ReplySOLD feature)
- Flash sales: time-limited discounts during live (Loyal Shops feature)
- Customer registration status in live (know if viewer is a registered customer)

### Phase 6: Multi-Platform & Scale

- TikTok Live integration (CommentSold differentiator)
- YouTube Live integration
- Multi-tenant agency features: manage multiple sellers/workspaces
- Mobile app for operators (iOS/Android)
- SMS/text notifications for live start (Loyal Shops feature)
- Loyalty/rewards program integration

---

## 16. Appendix

### A. Competitive Feature Matrix

| Feature | Loyal Shops | ReplySOLD | SoldLive | CommentSold | Our MVP |
|---------|-------------|-----------|----------|-------------|---------|
| FB Live claim detection | Yes | Yes | Yes | Yes | ✅ Yes |
| IG Live support | No | No | Yes | Yes | ✅ Yes* |
| Auto comment reply | Yes | Yes | Yes | Yes | ❌ Phase 2 |
| Waitlist management | Yes | Yes | Yes | Yes | ✅ Yes |
| Multi-quantity (1–30) | Yes | Yes | Yes | Yes | ✅ Yes |
| Pass/release workflow | Yes | Yes | Yes | Yes | ✅ Yes |
| Multi-variant parsing | Pro only | Yes | Yes | Yes | ❌ Phase 4 |
| Shopify integration | No | Yes | Yes | Yes | ❌ Phase 3 |
| Auto cart in Messenger | No | Yes | Yes | Yes | ❌ Phase 3 |
| Barcode scanning | No | Yes | No | Yes | ❌ Phase 5 |
| 24/7 post-live monitoring | No | Yes | No | Yes | ❌ Phase 5 |
| Live overlay | No | No | Yes | Yes | ❌ Phase 5 |
| TikTok Live | No | No | No | Yes | ❌ Phase 6 |
| CSV export | Yes | Yes | No | Yes | ✅ Yes |
| Real-time comment log | Yes | Yes | No | Yes | ✅ Yes |
| Pricing | $14.99+/mo | $49.99/mo | $49/mo | $49+/mo | TBD |

\* IG Live support requires Meta App Review approval for `live_comments` webhook.

### B. Glossary

| Term | Definition |
|------|-----------|
| Claim | A parsed intent from a viewer's comment indicating they want to purchase an item |
| Winner | The first valid claimant for an item (or unit of an item) |
| Waitlist | Ordered queue of subsequent claimants, auto-promoted when winners release |
| Pass | A viewer or operator releases their claim on an item |
| Show | A live sale session tied to one broadcast |
| Operator | The seller/host running the live sale |
| Ingestion | The process of reading comments from a platform (polling or webhook) |
| Allocation | The transactional process of assigning a claim as winner or waitlist |
| FIFO | First In, First Out — the ordering principle for waitlists |
| Graph API | Meta's HTTP API for accessing Facebook and Instagram data |
