# Feature: error-handling — Error Handling & Edge Cases

> **Status:** DONE
> **Created:** 2026-02-10
> **Priority:** MEDIUM

## Tasks

### TASK-001: Fix SSE token expiration on reconnect — DONE

**Problem:** EventSource auto-reconnect reuses the same URL with a potentially expired JWT token, causing infinite 401 failures.

**Fix:** Disabled EventSource auto-reconnect. On error, the hook now:
1. Closes the stale EventSource
2. Attempts token refresh via `tryRefresh()`
3. Gets a fresh access token
4. Creates a new EventSource with the fresh token URL
5. Exponential backoff up to 30 seconds

**Files changed:**
- `src/hooks/use-websocket.ts` — Manual reconnect with token refresh
- `src/lib/api-client.ts` — Exported `tryRefresh` for reuse

### TASK-002: Verify polling fallback covers missed events — DONE (already working)

The console page already has a polling fallback (every 5s when SSE is disconnected) that re-fetches all show data, claims, and comments. This catches up on any events missed during reconnection gaps.
