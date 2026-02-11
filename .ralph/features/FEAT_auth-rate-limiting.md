# Feature: auth-rate-limiting — Rate Limit Auth Endpoints

> **Status:** DONE
> **Created:** 2026-02-10
> **Priority:** MEDIUM

## Tasks

### TASK-001: Create rate limiter utility — DONE

Created `src/lib/rate-limit.ts`:
- In-memory sliding window rate limiter
- No external dependencies
- Auto-cleans expired entries every 60s
- Persists across HMR via globalThis
- 5 unit tests passing (`tests/unit/rate-limit.test.ts`)

### TASK-002: Apply rate limiting to auth routes — DONE

Limits applied:
- `POST /api/auth/login` — 10 req / 15 min per IP
- `POST /api/auth/register` — 5 req / 1 hour per IP
- `POST /api/auth/refresh` — 30 req / 15 min per IP

Returns 429 with `Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset` headers.
