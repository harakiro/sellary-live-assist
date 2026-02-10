# CLAUDE.md — Sellary Live Assist

## Project Overview

**Sellary Live Assist** (a.k.a. Live Sale Listener) is a Facebook Live + Instagram Live comment-to-claim engine for live-stream sellers. Viewers comment patterns like "sold 123" during broadcasts, and the system detects claims, assigns items via FIFO waitlist, and presents everything in a real-time operator console.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) with TypeScript |
| Styling | Tailwind CSS |
| Database | PostgreSQL 15+ |
| ORM | Drizzle ORM |
| Real-time | WebSocket (ws library) |
| Auth | Custom JWT (jose library) with bcrypt password hashing |
| Token Encryption | Node.js crypto (AES-256-GCM) for Meta OAuth tokens |
| Task Queue | BullMQ + Redis (polling workers) |
| Testing | Vitest (unit/integration), Playwright (E2E) |
| Linting | ESLint + Prettier |

## Project Structure

```
sellary-live-assist/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Auth pages (login, register)
│   │   ├── (dashboard)/        # Authenticated layout
│   │   │   ├── dashboard/      # Dashboard page
│   │   │   ├── shows/          # Shows list + detail pages
│   │   │   │   └── [id]/
│   │   │   │       └── console/  # Live operator console
│   │   │   ├── connections/    # Social connection management
│   │   │   └── settings/       # Workspace settings
│   │   ├── api/                # API routes
│   │   │   ├── auth/           # Auth endpoints
│   │   │   ├── connections/    # OAuth + connection management
│   │   │   ├── shows/          # Show CRUD + lifecycle
│   │   │   ├── claims/         # Claim actions (release, award)
│   │   │   ├── webhooks/       # Instagram webhook receiver
│   │   │   ├── realtime/       # WebSocket upgrade endpoint
│   │   │   └── debug/          # Dev-only simulation endpoints
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                 # Reusable UI primitives (shadcn/ui)
│   │   ├── console/            # Live console panels
│   │   │   ├── items-panel.tsx
│   │   │   ├── claim-feed.tsx
│   │   │   ├── comment-stream.tsx
│   │   │   ├── status-bar.tsx
│   │   │   └── item-detail-drawer.tsx
│   │   ├── shows/              # Show-related components
│   │   └── connections/        # Connection-related components
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts       # Drizzle schema definitions
│   │   │   ├── index.ts        # DB client singleton
│   │   │   └── migrations/     # SQL migration files
│   │   ├── auth/
│   │   │   ├── jwt.ts          # JWT sign/verify helpers
│   │   │   ├── middleware.ts   # Auth middleware for API routes
│   │   │   └── password.ts     # bcrypt helpers
│   │   ├── claim-engine/
│   │   │   ├── parser.ts       # Comment normalization + pattern matching
│   │   │   ├── allocator.ts    # Transactional allocation (winner/waitlist)
│   │   │   └── types.ts        # ClaimIntent, PassIntent types
│   │   ├── platforms/
│   │   │   ├── types.ts        # Common CommentEvent interface
│   │   │   ├── facebook/
│   │   │   │   ├── oauth.ts    # FB OAuth flow helpers
│   │   │   │   ├── polling.ts  # FB Live comment polling worker
│   │   │   │   └── api.ts      # FB Graph API client
│   │   │   └── instagram/
│   │   │       ├── oauth.ts    # IG OAuth flow helpers
│   │   │       ├── webhook.ts  # IG webhook verification + processing
│   │   │       └── api.ts      # IG Graph API client
│   │   ├── realtime/
│   │   │   ├── server.ts       # WebSocket server setup
│   │   │   └── events.ts       # Event types and emitter
│   │   ├── encryption.ts       # AES-256-GCM encrypt/decrypt for tokens
│   │   └── utils.ts            # Shared utilities
│   ├── hooks/                  # React hooks (useWebSocket, etc.)
│   └── types/                  # Shared TypeScript types
├── drizzle/                    # Drizzle config + generated migrations
├── tests/
│   ├── unit/                   # Vitest unit tests
│   │   ├── parser.test.ts
│   │   ├── allocator.test.ts
│   │   └── encryption.test.ts
│   ├── integration/            # Integration tests (needs DB)
│   │   ├── claims.test.ts
│   │   ├── waitlist.test.ts
│   │   └── websocket.test.ts
│   └── e2e/                    # Playwright E2E tests
├── PRD.md
├── PLAN.md
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── next.config.ts
├── drizzle.config.ts
├── tailwind.config.ts
├── vitest.config.ts
├── playwright.config.ts
├── .env.example
├── .eslintrc.json
├── .prettierrc
└── docker-compose.yml          # PostgreSQL + Redis for local dev
```

## Commands

```bash
# Development
npm run dev              # Start Next.js dev server (port 3000)
npm run build            # Production build
npm run start            # Start production server

# Database
npm run db:generate      # Generate Drizzle migrations from schema changes
npm run db:migrate       # Run pending migrations
npm run db:push          # Push schema directly (dev only)
npm run db:studio        # Open Drizzle Studio (DB browser)
npm run db:seed          # Seed database with test data

# Testing
npm run test             # Run Vitest unit + integration tests
npm run test:unit        # Run unit tests only
npm run test:integration # Run integration tests only
npm run test:e2e         # Run Playwright E2E tests
npm run test:coverage    # Run tests with coverage report

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Run ESLint with auto-fix
npm run format           # Run Prettier
npm run typecheck        # Run TypeScript type checking

# Docker (local services)
docker compose up -d     # Start PostgreSQL + Redis
docker compose down      # Stop services
```

## Database

- **PostgreSQL 15+** via Docker for local dev
- **Drizzle ORM** for type-safe queries and migrations
- Schema defined in `src/lib/db/schema.ts`
- Migrations in `drizzle/` directory
- Key tables: `workspaces`, `users`, `social_connections`, `shows`, `show_items`, `claims`, `comments`, `audit_log`
- Row-level locking (`SELECT ... FOR UPDATE`) used in allocation engine for concurrency safety
- All tables use UUID primary keys and `created_at`/`updated_at` timestamps

## Key Architecture Decisions

### Claim Engine
- **Parser** (`src/lib/claim-engine/parser.ts`): Normalizes comments (lowercase, strip punctuation/emoji, collapse whitespace) then matches against patterns: `sold {n}`, `{n} sold`, `sold{n}`, `pass {n}`, `{n} pass`. Claim word is configurable per workspace.
- **Allocator** (`src/lib/claim-engine/allocator.ts`): Runs within a DB transaction. Uses `SELECT ... FOR UPDATE` on `show_items` to prevent race conditions. First valid claim = winner, subsequent = waitlist (FIFO). Duplicate claims (same user + item) silently ignored. Idempotency key on every claim prevents reprocessing.

### Platform Adapters
- **Facebook Live**: Polling `/{live-video-id}/comments` every 2 seconds. Tracks `last_seen_comment_id`. Exponential backoff on rate limits.
- **Instagram Live**: Webhook-based via Meta webhook subscriptions. HMAC signature verification required. Gated on Meta App Review approval.
- Both adapters normalize to a common `CommentEvent` type before passing to claim engine.

### Real-Time
- WebSocket server on `/api/realtime?show_id={id}&token={jwt}`
- Events: `claim.created`, `claim.released`, `item.updated`, `session.status`, `comment.received`, `error`
- 30-second heartbeat ping/pong
- Client-side reconnection with exponential backoff

### Auth
- Custom JWT auth (not NextAuth) with `jose` library
- Access token (15min) + refresh token (7d)
- Passwords hashed with bcrypt (12 rounds)
- API routes protected via middleware that validates JWT and attaches user/workspace context

### Token Encryption
- Meta OAuth tokens encrypted at rest using AES-256-GCM
- Encryption key stored in environment variable (`TOKEN_ENCRYPTION_KEY`)
- Tokens only decrypted in-memory when making API calls

## Environment Variables

Required variables (see `.env.example`):

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/sellary_live_assist

# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=<random-32-byte-hex>
JWT_REFRESH_SECRET=<random-32-byte-hex>

# Meta OAuth
META_APP_ID=<from-meta-developer-console>
META_APP_SECRET=<from-meta-developer-console>
META_GRAPH_API_VERSION=v22.0

# Token Encryption
TOKEN_ENCRYPTION_KEY=<random-32-byte-hex>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

## Development Guidelines

### Code Style
- TypeScript strict mode enabled
- Prefer `type` over `interface` for object shapes
- Use Drizzle query builder, not raw SQL (except in transactions where raw is cleaner)
- API routes return consistent `{ data }` or `{ error: { code, message } }` shape
- All API errors use structured error codes, not just HTTP status
- Zod for runtime validation of API inputs

### Testing
- Unit tests for pure functions (parser, encryption, utilities)
- Integration tests hit a real test database (separate from dev)
- Use the debug endpoints (`/api/debug/emit_comment`) for integration testing the claim engine
- Test concurrent allocation with parallel requests to verify row locking

### Security
- Never log decrypted tokens or secrets
- Validate webhook signatures (HMAC-SHA256) before processing
- Rate-limit auth endpoints
- Sanitize all user input before storage
- Debug endpoints disabled in production (`NODE_ENV !== 'development'`)

### Performance
- WebSocket connections scoped per show (no global broadcast)
- Comment polling uses cursor-based pagination to avoid re-fetching
- Database indexes on hot query paths (see PRD Section 8.3)
- Minimize WebSocket payload size (send IDs, let client fetch details if needed)
