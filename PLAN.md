# Implementation Plan — Sellary Live Assist

## Overview

This plan breaks down the MVP build into 5 milestones with granular, actionable tasks. Each task includes specific files to create/modify, acceptance criteria, and dependencies.

**Reference:** [PRD.md](./PRD.md) for full requirements.

---

## Milestone 0: Project Scaffold

**Goal:** Bootable Next.js app with auth, database, and base UI shell.

### Task 0.1: Initialize Next.js + TypeScript Project

**Files to create:**
- `package.json` — Dependencies: next, react, react-dom, typescript, tailwindcss, drizzle-orm, pg, jose, bcryptjs, zod, ws, uuid
- `tsconfig.json` — Strict mode, paths alias `@/` → `src/`
- `next.config.ts` — Webpack config for `ws` (externalize for server-side)
- `tailwind.config.ts` — Content paths, custom theme (brand colors)
- `.eslintrc.json` — Next.js recommended + TypeScript rules
- `.prettierrc` — 2-space indent, single quotes, trailing comma
- `postcss.config.js` — Tailwind + autoprefixer
- `src/app/layout.tsx` — Root layout with Tailwind globals
- `src/app/page.tsx` — Landing/redirect page
- `.env.example` — All required env vars documented
- `.gitignore` — node_modules, .next, .env*, drizzle/meta

**Acceptance criteria:**
- `npm run dev` starts without errors
- `npm run build` succeeds
- `npm run lint` passes
- TypeScript strict mode active, `npm run typecheck` passes

### Task 0.2: Docker Compose for Local Services

**Files to create:**
- `docker-compose.yml` — PostgreSQL 15 + Redis 7 services

**Acceptance criteria:**
- `docker compose up -d` starts both services
- PostgreSQL accessible at `localhost:5432`
- Redis accessible at `localhost:6379`

### Task 0.3: Database Schema + Drizzle ORM Setup

**Files to create:**
- `drizzle.config.ts` — Drizzle Kit config pointing to schema and DB URL
- `src/lib/db/index.ts` — Database client singleton (drizzle + pg Pool)
- `src/lib/db/schema.ts` — Full Drizzle schema:
  - `workspaces` table (id, owner_user_id, name, settings JSONB, timestamps)
  - `users` table (id, email, password_hash, name, timestamps)
  - `social_connections` table (id, workspace_id, platform, external_account_id, display_name, encrypted_access_token, token_expires_at, refresh_token_encrypted, scopes, status, timestamps)
  - `shows` table (id, workspace_id, name, status, platform, connection_id, live_id, live_url, claim_word, pass_word, started_at, ended_at, timestamps)
  - `show_items` table (id, show_id, item_number, title, description, total_quantity, claimed_count, status, timestamps)
  - `claims` table (id, show_id, show_item_id, item_number, platform, live_id, platform_user_id, user_handle, user_display_name, comment_id, raw_text, normalized_text, claim_type, claim_status, waitlist_position, idempotency_key UNIQUE, operator_action, operator_notes, timestamps)
  - `comments` table (id, show_id, live_id, platform, platform_user_id, user_handle, comment_id, raw_text, normalized_text, parsed, claim_id FK, received_at, timestamps)
  - `audit_log` table (id, workspace_id, show_id, actor_user_id, action, entity_type, entity_id, details JSONB, timestamps)
  - All indexes from PRD Section 8.3
  - Enums: platform, show_status, item_status, claim_type, claim_status, connection_status

**Scripts to add to package.json:**
- `db:generate` — `drizzle-kit generate`
- `db:migrate` — `drizzle-kit migrate`
- `db:push` — `drizzle-kit push`
- `db:studio` — `drizzle-kit studio`

**Acceptance criteria:**
- `npm run db:push` applies schema to PostgreSQL without errors
- All tables created with correct columns, constraints, and indexes
- Drizzle client can insert and query rows with full type safety

### Task 0.4: Authentication System

**Files to create:**
- `src/lib/auth/password.ts` — `hashPassword(plain)` and `verifyPassword(plain, hash)` using bcryptjs (12 rounds)
- `src/lib/auth/jwt.ts` — `signAccessToken(payload)`, `signRefreshToken(payload)`, `verifyAccessToken(token)`, `verifyRefreshToken(token)` using jose. Access token: 15min expiry. Refresh token: 7 days.
- `src/lib/auth/middleware.ts` — `withAuth(handler)` wrapper that extracts Bearer token, verifies JWT, attaches `{ userId, workspaceId }` to request context. Returns 401 on invalid/expired token.
- `src/lib/validations/auth.ts` — Zod schemas for register, login request bodies
- `src/app/api/auth/register/route.ts` — POST: validate input, check email uniqueness, hash password, create user + workspace, return tokens
- `src/app/api/auth/login/route.ts` — POST: validate input, find user by email, verify password, return tokens
- `src/app/api/auth/refresh/route.ts` — POST: validate refresh token, issue new token pair
- `src/app/api/auth/me/route.ts` — GET (authenticated): return current user profile + workspace

**Acceptance criteria:**
- Register with email/password returns access + refresh tokens
- Login with valid credentials returns tokens
- Login with invalid credentials returns 401
- `/api/auth/me` with valid token returns user data
- `/api/auth/me` without token returns 401
- Refresh endpoint issues new token pair
- Duplicate email registration returns 409

### Task 0.5: Base UI Shell

**Files to create:**
- `src/app/(auth)/login/page.tsx` — Login form (email + password)
- `src/app/(auth)/register/page.tsx` — Registration form
- `src/app/(auth)/layout.tsx` — Centered auth layout
- `src/app/(dashboard)/layout.tsx` — Authenticated layout with sidebar navigation
- `src/app/(dashboard)/dashboard/page.tsx` — Dashboard (shows list, quick stats)
- `src/app/(dashboard)/shows/page.tsx` — Shows list (placeholder)
- `src/app/(dashboard)/connections/page.tsx` — Connections page (placeholder)
- `src/app/(dashboard)/settings/page.tsx` — Settings page (placeholder)
- `src/components/ui/button.tsx` — Button component
- `src/components/ui/input.tsx` — Input component
- `src/components/ui/card.tsx` — Card component
- `src/components/ui/badge.tsx` — Status badge component
- `src/hooks/use-auth.ts` — Auth context hook (store tokens, fetch user, redirect on 401)
- `src/lib/api-client.ts` — Fetch wrapper that attaches auth headers, handles token refresh

**Acceptance criteria:**
- User can register, login, and see the dashboard
- Navigation between Dashboard, Shows, Connections, Settings works
- Unauthenticated access redirects to login
- UI is responsive and styled with Tailwind

### Task 0.6: Testing Infrastructure

**Files to create:**
- `vitest.config.ts` — Vitest config with path aliases, test DB setup
- `tests/setup.ts` — Test setup (env vars, DB connection for integration tests)
- `tests/helpers.ts` — Test utilities (create test user, create test show, etc.)
- `playwright.config.ts` — Playwright config for E2E tests

**Scripts to add to package.json:**
- `test` — `vitest run`
- `test:unit` — `vitest run tests/unit`
- `test:integration` — `vitest run tests/integration`
- `test:e2e` — `playwright test`
- `test:coverage` — `vitest run --coverage`

**Acceptance criteria:**
- `npm run test` runs and reports results
- Tests can access a test database (separate from dev)
- Path aliases resolve correctly in tests

### Task 0.7: CI Pipeline

**Files to create:**
- `.github/workflows/ci.yml` — GitHub Actions: lint, typecheck, test (with PostgreSQL service container)

**Acceptance criteria:**
- Push to any branch triggers lint + typecheck + test
- Pipeline uses PostgreSQL service container for integration tests

---

## Milestone 1: Core Claim Engine + Real-Time UI

**Goal:** Working claim detection, allocation, waitlist, and live operator console — all testable via debug endpoints.

### Task 1.1: Claim Parser

**Files to create:**
- `src/lib/claim-engine/types.ts` — Types:
  ```typescript
  type ClaimIntent = { type: 'claim'; itemNumber: string; rawText: string }
  type PassIntent = { type: 'pass'; itemNumber: string; rawText: string }
  type ParseResult = ClaimIntent | PassIntent | null
  ```
- `src/lib/claim-engine/parser.ts` — Functions:
  - `normalizeComment(text: string): string` — lowercase, trim, strip punctuation (keep digits+letters), collapse whitespace, strip emoji/unicode
  - `parseComment(normalizedText: string, claimWord?: string, passWord?: string): ParseResult` — Match against all patterns from PRD FR2. Default claim word "sold", default pass word "pass".
- `tests/unit/parser.test.ts` — Test cases:
  - "sold 123" → claim, item 123
  - "123 sold" → claim, item 123
  - "sold123" → claim, item 123
  - "SOLD 456" → claim, item 456 (case insensitive)
  - "pass 123" → pass, item 123
  - "123 pass" → pass, item 123
  - "hello everyone" → null (no match)
  - "" → null
  - "sold" (no number) → null
  - "123" (no keyword) → null
  - "sold 123 and sold 456" → claim, item 123 (first match)
  - Custom claim word: "mine 123" with claimWord="mine" → claim
  - Emoji in text: "sold 123 🔥🔥" → claim, item 123
  - Punctuation: "sold #123!" → claim, item 123

**Acceptance criteria:**
- All parser tests pass
- Parser handles all patterns from PRD FR2
- Custom claim/pass words work correctly

### Task 1.2: Allocation Engine

**Files to create:**
- `src/lib/claim-engine/allocator.ts` — Functions:
  - `processClaimIntent(db, showId, intent, commentInfo): Promise<ClaimResult>` — Main allocation function. Within a transaction:
    1. Look up show_item by (show_id, item_number) with `FOR UPDATE` lock
    2. If item not found → return `{ status: 'item_not_found' }`
    3. Check idempotency_key → if exists, return `{ status: 'duplicate' }`
    4. Check deduplication (same user + same item already claimed) → return `{ status: 'duplicate_user' }`
    5. If available quantity > 0 → insert claim as `winner`, increment claimed_count, update item status
    6. If available = 0 → insert claim as `waitlist`, assign next position
    7. Return claim record + updated item
  - `processPassIntent(db, showId, intent, commentInfo): Promise<PassResult>` — Release logic:
    1. Find active claim for user+item
    2. If claim is winner → mark as `released`, decrement claimed_count
    3. If waitlist exists → promote first waitlisted to winner, increment claimed_count
    4. Update item status accordingly
    5. Return results including any promoted claim
  - `releaseClaim(db, claimId, operatorUserId): Promise<ReleaseResult>` — Operator-initiated release (same as pass but with operator attribution)
  - `manualAward(db, showId, itemId, userHandle, operatorUserId): Promise<AwardResult>` — Operator manually assigns item
- `src/lib/claim-engine/idempotency.ts` — `generateIdempotencyKey(platform, commentId, liveId?, userId?, text?, timestamp?): string` — Hash-based key generation per PRD Section 8.2
- `tests/unit/idempotency.test.ts` — Idempotency key consistency tests
- `tests/integration/allocator.test.ts` — Integration tests:
  - First claim wins
  - Second claim goes to waitlist
  - Duplicate claim from same user is ignored
  - Pass promotes waitlist
  - Pass with no waitlist frees item
  - Multi-quantity: N winners before waitlist
  - Idempotency key prevents duplicate processing
  - Concurrent claims resolved correctly (parallel test)

**Acceptance criteria:**
- All allocation tests pass
- Transactions prevent race conditions under concurrent load
- Waitlist promotion works correctly
- Multi-quantity items support multiple winners

### Task 1.3: WebSocket Server

**Files to create:**
- `src/lib/realtime/events.ts` — Event type definitions matching PRD FR11:
  - `ClaimCreatedEvent`, `ClaimReleasedEvent`, `ItemUpdatedEvent`, `SessionStatusEvent`, `CommentReceivedEvent`, `ErrorEvent`
- `src/lib/realtime/server.ts` — WebSocket server:
  - Attach to Next.js HTTP server (or custom server)
  - Connection auth: verify JWT from query param
  - Room management: clients join a show room by `show_id`
  - `broadcastToShow(showId, event)` — Send event to all connected clients for a show
  - 30-second heartbeat ping/pong
  - Connection cleanup on disconnect
- `src/lib/realtime/client.ts` — Client-side WebSocket hook helpers
- `src/hooks/use-websocket.ts` — React hook: connect to show, handle events, auto-reconnect with backoff
- `tests/integration/websocket.test.ts` — WebSocket connection, event delivery, room isolation

**Acceptance criteria:**
- Client connects via WebSocket with valid JWT
- Events broadcast to all clients in a show room
- Clients in different shows don't receive each other's events
- Heartbeat keeps connections alive
- Auto-reconnect on disconnect

### Task 1.4: Debug Endpoints

**Files to create:**
- `src/app/api/debug/emit-comment/route.ts` — POST: accepts `{ showId, userId, userHandle, text, timestamp? }`. Normalizes, parses, allocates, emits WebSocket events. Returns claim result. Only available when `NODE_ENV === 'development'`.
- `src/app/api/debug/emit-ig-webhook/route.ts` — POST: accepts simulated IG webhook payload format. Processes through full IG pipeline. Dev only.
- `src/app/api/debug/bulk-comments/route.ts` — POST: accepts `{ showId, comments: [{ userId, userHandle, text, delay? }] }`. Processes sequentially with optional delays. Dev only.

**Acceptance criteria:**
- `POST /api/debug/emit-comment` with "sold 123" creates a winner claim
- Bulk comments endpoint processes N comments in order
- Endpoints return 404 in production

### Task 1.5: Live Console UI — Items Panel

**Files to create:**
- `src/app/(dashboard)/shows/[id]/console/page.tsx` — Live console page layout (3-column)
- `src/components/console/items-panel.tsx` — Left panel:
  - Scrollable list of show items
  - Each item: item number, title, quantity (available/total), status badge
  - Color-coded: green (unclaimed), yellow (partial), red (sold out)
  - Click to expand item detail drawer
- `src/components/console/item-detail-drawer.tsx` — Slide-out panel:
  - Winner(s) with username and timestamp
  - Ordered waitlist with position numbers
  - Action buttons: Release, Pass, Manual Award

**Acceptance criteria:**
- Items panel renders all show items
- Status badges reflect current state
- Item detail drawer shows winners + waitlist
- Operator actions (release, award) trigger API calls

### Task 1.6: Live Console UI — Claim Feed

**Files to create:**
- `src/components/console/claim-feed.tsx` — Center panel:
  - Reverse-chronological feed of claim events
  - Each entry: timestamp, @username, item number, status badge
  - Color-coded: green (winner), blue (waitlist), gray (duplicate/ignored)
  - Search bar to filter by username or item number
  - Auto-scrolls to latest entries

**Acceptance criteria:**
- Claim feed updates in real-time via WebSocket
- Entries are color-coded by status
- Search/filter works correctly

### Task 1.7: Live Console UI — Comment Stream + Status Bar

**Files to create:**
- `src/components/console/comment-stream.tsx` — Right panel:
  - Full comment stream from live broadcast
  - Each comment: timestamp, @username, text
  - Highlights claim-matching comments
  - Searchable
- `src/components/console/status-bar.tsx` — Top bar:
  - Show name
  - Live status indicator (green dot pulsing)
  - Elapsed time clock (auto-updating)
  - Items claimed / total count
  - Unique buyers count
  - Pause/Resume/Stop buttons

**Acceptance criteria:**
- Comment stream shows all comments (not just claims)
- Status bar stats update in real-time
- Pause/Resume/Stop buttons trigger correct API calls
- Elapsed time clock runs while show is active

### Task 1.8: Show CRUD API + UI

**Files to create:**
- `src/lib/validations/shows.ts` — Zod schemas for show creation, update, item add
- `src/app/api/shows/route.ts` — GET (list shows for workspace), POST (create show)
- `src/app/api/shows/[id]/route.ts` — GET (show detail), PATCH (update)
- `src/app/api/shows/[id]/items/route.ts` — POST (add items)
- `src/app/api/shows/[id]/items/[itemId]/route.ts` — PATCH (update item), DELETE (remove unclaimed item)
- `src/app/api/shows/[id]/activate/route.ts` — POST: transition to active, start ingestion
- `src/app/api/shows/[id]/pause/route.ts` — POST: pause ingestion
- `src/app/api/shows/[id]/resume/route.ts` — POST: resume ingestion
- `src/app/api/shows/[id]/stop/route.ts` — POST: end show, stop ingestion
- `src/app/api/shows/[id]/claims/route.ts` — GET: list claims (filterable by status, item, user)
- `src/app/api/shows/[id]/comments/route.ts` — GET: full comment log
- `src/app/api/shows/[id]/buyers/route.ts` — GET: buyer rollup view
- `src/app/api/claims/[id]/release/route.ts` — POST: release a claim
- `src/app/api/shows/[id]/items/[itemId]/award/route.ts` — POST: manual award
- `src/app/(dashboard)/shows/new/page.tsx` — Create show form
- `src/app/(dashboard)/shows/[id]/page.tsx` — Show detail page (items list, add items, show status)

**Acceptance criteria:**
- Full show CRUD works
- Items can be added/updated/removed
- Show lifecycle transitions (draft → active → paused → ended) work correctly
- Claims and comments are queryable with filters
- Buyer rollup aggregates correctly

---

## Milestone 2: Meta OAuth + Social Connections

**Goal:** Connect Facebook Pages and Instagram accounts via OAuth, store tokens securely.

### Task 2.1: Token Encryption

**Files to create:**
- `src/lib/encryption.ts` — Functions:
  - `encrypt(plaintext: string, key: string): string` — AES-256-GCM encryption, returns `iv:authTag:ciphertext` base64
  - `decrypt(encrypted: string, key: string): string` — AES-256-GCM decryption
- `tests/unit/encryption.test.ts` — Round-trip encrypt/decrypt, different keys fail, tampered ciphertext fails

**Acceptance criteria:**
- Encrypt + decrypt round-trips correctly
- Wrong key throws error
- Tampered ciphertext throws error

### Task 2.2: Meta OAuth Flow — Facebook

**Files to create:**
- `src/lib/platforms/facebook/oauth.ts` — Functions:
  - `buildFBAuthUrl(redirectUri, state): string` — Build Meta OAuth URL with FB page permissions
  - `exchangeCodeForToken(code, redirectUri): Promise<TokenResponse>` — Exchange auth code for access token
  - `exchangeForLongLivedToken(shortToken): Promise<TokenResponse>` — Extend to 60-day token
  - `getConnectedPages(accessToken): Promise<Page[]>` — List pages the user manages
- `src/app/api/connections/oauth/facebook/start/route.ts` — GET: generate state param, store in session/cookie, redirect to Meta OAuth URL
- `src/app/api/connections/oauth/facebook/callback/route.ts` — GET: verify state, exchange code, get pages, create social_connection records with encrypted tokens

**Acceptance criteria:**
- OAuth redirect sends user to Meta with correct permissions requested
- Callback exchanges code and stores encrypted token
- Connected pages appear in database with display names

### Task 2.3: Meta OAuth Flow — Instagram

**Files to create:**
- `src/lib/platforms/instagram/oauth.ts` — Functions:
  - `buildIGAuthUrl(redirectUri, state): string` — Build Meta OAuth URL with IG permissions
  - `exchangeCodeForToken(code, redirectUri): Promise<TokenResponse>` — Token exchange
  - `getConnectedIGAccounts(pageAccessToken): Promise<IGAccount[]>` — Get IG accounts linked to FB pages
- `src/app/api/connections/oauth/instagram/start/route.ts` — GET: redirect to Meta OAuth for IG permissions
- `src/app/api/connections/oauth/instagram/callback/route.ts` — GET: exchange code, find linked IG accounts, create social_connection records

**Acceptance criteria:**
- OAuth flow works for Instagram Professional accounts
- IG account linked via associated FB page
- Token stored encrypted

### Task 2.4: Connection Management UI + API

**Files to create:**
- `src/app/api/connections/route.ts` — GET: list all connections for workspace
- `src/app/api/connections/[id]/route.ts` — DELETE: disconnect (revoke token if possible, remove record)
- `src/app/(dashboard)/connections/page.tsx` — Full connections page:
  - "Connect Facebook Page" button → initiates OAuth
  - "Connect Instagram Account" button → initiates OAuth
  - List of connected accounts with: platform icon, display name, status badge (active/expired), connected date
  - Disconnect button per connection
  - Token health indicator (days until expiration)
- `src/lib/platforms/token-refresh.ts` — Token refresh logic: check expiration, refresh if needed, update DB

**Acceptance criteria:**
- Connections page lists all connected accounts
- Connect buttons initiate correct OAuth flows
- Disconnect removes the connection
- Expired tokens show warning indicator

---

## Milestone 3: Facebook Live Integration

**Goal:** Full end-to-end flow: detect live broadcasts → poll comments → process claims → real-time UI.

### Task 3.1: Live Discovery for Facebook

**Files to create:**
- `src/lib/platforms/facebook/api.ts` — Functions:
  - `getActiveLives(pageAccessToken, pageId): Promise<LiveVideo[]>` — Query `/{page-id}/live_videos?broadcast_status=LIVE`
  - `getLiveVideoById(accessToken, liveVideoId): Promise<LiveVideo>` — Get specific live video details
- `src/app/api/connections/[id]/lives/route.ts` — GET: decrypt token, query platform for active lives, return list
- Update `src/app/(dashboard)/shows/[id]/page.tsx` — Add "Detect Active Lives" button, live selection dropdown

**Acceptance criteria:**
- Active lives for a connected FB Page are fetched and displayed
- Operator can select a live broadcast for their show
- Fallback: paste a live video URL/ID directly

### Task 3.2: Facebook Comment Polling Worker

**Files to create:**
- `src/lib/platforms/facebook/polling.ts` — Polling worker:
  - `startPolling(showId, liveVideoId, accessToken, interval): void` — Start polling loop
  - Poll `/{live-video-id}/comments` with reverse chronological ordering
  - Track `after` cursor to avoid reprocessing
  - Normalize each comment to `CommentEvent` format
  - Pass each comment through claim engine (parse → allocate → emit events)
  - Store all comments in `comments` table
  - Exponential backoff on HTTP 429
  - `stopPolling(showId): void` — Stop polling loop
- `src/lib/platforms/types.ts` — Common `CommentEvent` interface:
  ```typescript
  type CommentEvent = {
    platform: 'facebook' | 'instagram'
    liveId: string
    commentId: string
    userId: string
    userHandle: string
    userDisplayName: string
    text: string
    timestamp: Date
  }
  ```

**Acceptance criteria:**
- Polling starts when show is activated
- Comments from FB Live are fetched and processed
- Claims created correctly from live comments
- No duplicate processing from overlapping polls
- Polling respects rate limits with backoff
- Polling stops when show is stopped/paused

### Task 3.3: Activate Show Flow (End-to-End)

**Files to modify:**
- `src/app/api/shows/[id]/activate/route.ts` — Update to: validate live_id, bind show to live, start polling worker, transition show to active, emit `session.status` event
- `src/app/api/shows/[id]/pause/route.ts` — Pause polling, update status
- `src/app/api/shows/[id]/resume/route.ts` — Resume polling, update status
- `src/app/api/shows/[id]/stop/route.ts` — Stop polling, transition to ended, emit final status

**Acceptance criteria:**
- Full flow: Create show → Add items → Detect lives → Select live → Activate → Comments processed → Claims appear in UI
- Pause/resume correctly halts and restarts ingestion
- Stop ends the show permanently
- All state transitions emit WebSocket events

### Task 3.4: End-to-End Integration Test (Facebook)

**Files to create:**
- `tests/integration/facebook-flow.test.ts` — Full pipeline test using debug endpoints:
  - Create show + items
  - Simulate FB comments (sold, duplicate, waitlist, pass, multi-quantity)
  - Verify all claim states correct
  - Verify WebSocket events received
  - Verify comment log complete

**Acceptance criteria:**
- Integration test covers all claim scenarios
- No race conditions or data inconsistencies

---

## Milestone 4: Instagram Live Integration

**Goal:** IG Live discovery + webhook-based comment ingestion.

### Task 4.1: Instagram Live Discovery

**Files to create:**
- `src/lib/platforms/instagram/api.ts` — Functions:
  - `getActiveLives(accessToken, igUserId): Promise<LiveMedia[]>` — Query `/{ig-user-id}/live_media`
- Update `src/app/api/connections/[id]/lives/route.ts` — Add IG live discovery alongside FB

**Acceptance criteria:**
- IG live broadcasts discoverable via API
- Works with simulated data pre-App Review

### Task 4.2: Instagram Webhook Endpoint

**Files to create:**
- `src/app/api/webhooks/instagram/route.ts` — Dual-method handler:
  - GET: Meta webhook verification handshake (verify_token challenge-response)
  - POST: Receive webhook events, verify HMAC-SHA256 signature, extract `live_comments` events, filter by active show's `live_media_id`, normalize to `CommentEvent`, process through claim engine
- `src/lib/platforms/instagram/webhook.ts` — Functions:
  - `verifyWebhookSignature(payload, signature, appSecret): boolean` — HMAC-SHA256 verification
  - `parseWebhookPayload(body): CommentEvent[]` — Extract comment events from webhook payload

**Acceptance criteria:**
- GET verification handshake responds correctly to Meta's challenge
- POST with valid signature processes comments
- POST with invalid signature returns 403
- Only comments matching active show's live_media_id are processed
- Comments from other lives are ignored

### Task 4.3: IG Webhook Simulation Testing

**Files to create/modify:**
- `src/app/api/debug/emit-ig-webhook/route.ts` — Simulate exact IG webhook payload format
- `tests/integration/instagram-flow.test.ts` — Full IG pipeline test:
  - Simulate webhook payloads
  - Verify claim processing
  - Verify signature verification
  - Test payload filtering

**Acceptance criteria:**
- Simulated IG webhooks processed correctly
- Full claim pipeline works for IG-sourced comments
- Claims from IG appear in same console UI as FB claims

---

## Milestone 5: Hardening, Polish & Export

**Goal:** Show summary, CSV export, settings, audit logging, error handling, polish.

### Task 5.1: Show Summary Page

**Files to create:**
- `src/app/(dashboard)/shows/[id]/summary/page.tsx` — Post-show summary:
  - Total items claimed / total items
  - Total unique buyers
  - Per-item breakdown (item number, title, winner(s), waitlist)
  - Timeline chart of claims over show duration
- `src/components/shows/buyer-rollup.tsx` — Buyer rollup view:
  - Grouped by buyer
  - Shows all items claimed per buyer
  - Total items count per buyer

**Acceptance criteria:**
- Summary page shows accurate stats after show ends
- Buyer rollup groups correctly
- Accessible from show detail page after show ends

### Task 5.2: CSV Export

**Files to create:**
- `src/app/api/shows/[id]/export/route.ts` — GET with `?type=claims|buyers`:
  - `claims` export: timestamp, item_number, item_title, user_handle, status, waitlist_position
  - `buyers` export: user_handle, items_claimed (comma-separated), total_items
  - Returns CSV with Content-Disposition header

**Acceptance criteria:**
- Claims CSV contains all claim records for the show
- Buyers CSV aggregates per buyer
- CSV is valid and importable into Excel/Sheets
- Filename includes show name and date

### Task 5.3: Settings Page

**Files to create:**
- `src/app/api/workspaces/[id]/route.ts` — PATCH: update workspace settings
- `src/app/(dashboard)/settings/page.tsx` — Settings form:
  - Workspace name
  - Default claim word (default: "sold")
  - Default pass word (default: "pass")
  - Default polling interval (2-10 seconds)
  - Workspace preferences (stored in settings JSONB)

**Acceptance criteria:**
- Settings save and persist
- Claim word setting used by new shows
- Shows can override workspace defaults

### Task 5.4: Audit Logging

**Files to create:**
- `src/lib/audit.ts` — `logAuditEvent(db, { workspaceId, showId, actorUserId, action, entityType, entityId, details })` — Insert audit log record
- Update all operator action endpoints to call audit logger:
  - Claim release
  - Manual award
  - Show activate/pause/resume/stop
  - Item add/update/delete
  - Connection add/remove

**Acceptance criteria:**
- All operator actions recorded in audit_log
- Audit entries include actor, action, target entity, and timestamp
- Details JSONB captures before/after state where relevant

### Task 5.5: Error Handling + Edge Cases

**Areas to harden:**
- API routes: consistent error responses `{ error: { code, message } }`
- WebSocket: handle connection drops, send error events for processing failures
- Polling: graceful handling of API errors, token expiration mid-show
- Claim engine: handle deleted items, ended shows, edge cases in quantity management
- UI: error toasts, loading states, empty states, network error recovery
- Token refresh: auto-refresh before expiration, notify operator on permanent failure

**Files to create:**
- `src/lib/errors.ts` — Error class hierarchy: `AppError`, `AuthError`, `NotFoundError`, `ConflictError`, `ValidationError`, `PlatformError`
- `src/components/ui/toast.tsx` — Toast notification component
- `src/components/ui/loading.tsx` — Loading spinner/skeleton components
- `src/components/ui/empty-state.tsx` — Empty state component

**Acceptance criteria:**
- No unhandled errors crash the application
- All API errors return structured JSON responses
- UI shows appropriate feedback for all error states
- WebSocket reconnects automatically after disconnection

### Task 5.6: Performance & Query Optimization

**Areas to optimize:**
- Ensure all hot query paths use indexes (verify with `EXPLAIN ANALYZE`)
- WebSocket event payloads are minimal (IDs + changed fields only)
- Comment polling uses cursor pagination efficiently
- Claim feed pagination (don't load all claims at once)
- Items panel efficient re-renders (React.memo, useMemo where needed)

**Acceptance criteria:**
- Claim allocation < 50ms under normal load
- UI remains responsive with 500+ claims
- No N+1 query patterns in API routes

### Task 5.7: Load Testing

**Files to create:**
- `tests/load/claim-engine.test.ts` — Load test:
  - 1,000 comments in 60 seconds via bulk endpoint
  - Verify: correct ordering, no duplicates, no data loss
  - Verify: all WebSocket events delivered
- `tests/load/websocket.test.ts` — WebSocket load test:
  - 50 concurrent connections
  - All receive same events

**Acceptance criteria:**
- 1,000 comments processed correctly with zero errors
- 50 concurrent WebSocket connections maintained
- No memory leaks during sustained operation

---

## Dependency Graph

```
M0.1 (Next.js init)
  ├── M0.2 (Docker) ──→ M0.3 (Database)
  │                        ├── M0.4 (Auth)
  │                        │     └── M0.5 (UI Shell)
  │                        ├── M1.1 (Parser) ──→ M1.2 (Allocator) ──→ M1.4 (Debug endpoints)
  │                        │                                              ├── M1.5-1.7 (Console UI)
  │                        │                                              └── M1.8 (Show CRUD)
  │                        └── M2.1 (Encryption)
  │                              ├── M2.2 (FB OAuth) ──→ M3.1 (FB Live Discovery)
  │                              │                          └── M3.2 (FB Polling) ──→ M3.3 (Activate flow)
  │                              └── M2.3 (IG OAuth) ──→ M4.1 (IG Discovery)
  │                                                        └── M4.2 (IG Webhook) ──→ M4.3 (IG Testing)
  └── M0.6 (Testing infra)
        └── M0.7 (CI)

M1.3 (WebSocket) depends on M0.3 (Database) + M0.1 (Next.js)
M5.* (Hardening) depends on M1-M4 completion
```

## Task Count Summary

| Milestone | Tasks | Focus |
|-----------|-------|-------|
| M0: Scaffold | 7 tasks | Project setup, DB, auth, UI shell, CI |
| M1: Claim Engine + UI | 8 tasks | Parser, allocator, WebSocket, console, show CRUD |
| M2: Meta OAuth | 4 tasks | Encryption, FB OAuth, IG OAuth, connection UI |
| M3: Facebook Live | 4 tasks | Live discovery, polling, activate flow, integration test |
| M4: Instagram Live | 3 tasks | Discovery, webhook, simulation testing |
| M5: Hardening | 7 tasks | Summary, export, settings, audit, errors, perf, load test |
| **Total** | **33 tasks** | |
