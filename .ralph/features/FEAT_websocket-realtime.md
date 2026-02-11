# Feature: websocket-realtime — Fix Real-Time Event Delivery

> **Status:** REVIEW
> **Created:** 2026-02-10
> **Priority:** CRITICAL — Blocks core product functionality

## Context

The live operator console is not receiving real-time updates. Server-side polling and claim processing work correctly, but the WebSocket delivery to the browser is completely broken. Server logs show `0/0 clients` on every broadcast. The UI falls back to 3-second HTTP polling, defeating the purpose of the real-time console.

**Root cause:** The standalone WebSocket server on a separate port (3001) never receives client connections. The architecture is fragile — lazy init, separate port, silent failures, WSL2/Docker/proxy incompatibility.

**Decision:** Replace WebSocket with **Server-Sent Events (SSE)** over regular Next.js API routes. SSE runs on the same port (3000), works through all proxies/firewalls/WSL2, requires no extra server, and is natively supported by all browsers.

---

## Review Cycle 1

### FIX-001: Replace standalone WS server with SSE event bus and streaming endpoint

**Status:** TODO
**Type:** CHANGE (architectural rewrite)
**Severity:** CRITICAL
**Review Cycle:** 1
**Reported:** 2026-02-10

**Description:**
Remove the standalone WebSocket server (`server.ts`) and replace it with:
1. A lightweight in-memory event emitter/bus (`src/lib/realtime/server.ts`) that the polling worker publishes to
2. An SSE streaming endpoint (`src/app/api/shows/[id]/stream/route.ts`) that subscribes to the bus and pushes events to connected browsers

This eliminates: the separate port, the owner/relay pattern, the EADDRINUSE fallback, the lazy initialization race condition.

**Root Cause:** Standalone WS server on port 3001 is unreachable from the browser (WSL2 port forwarding, lazy init, silent EADDRINUSE fallback).

**Acceptance Criteria:**
- [ ] `src/lib/realtime/server.ts` is rewritten as a simple EventEmitter-based pub/sub (no `ws` library, no `http.createServer`, no separate port)
- [ ] `broadcastToShow(showId, event)` API unchanged — polling worker code requires zero changes
- [ ] New SSE route `GET /api/shows/[id]/stream` authenticates via Bearer token, subscribes to show events, streams them as SSE `data:` frames
- [ ] SSE endpoint sends heartbeat comments every 15s to keep connection alive
- [ ] SSE endpoint cleans up listener on client disconnect
- [ ] `WS_PORT` and `NEXT_PUBLIC_WS_URL` environment variables removed
- [ ] `.env.example` updated (WS vars removed)
- [ ] Old `shutdownWebSocket()`, `getShowConnectionCount()`, relay functions removed

**Files:**
- Rewrite: `src/lib/realtime/server.ts`
- Create: `src/app/api/shows/[id]/stream/route.ts`
- Modify: `src/lib/realtime/events.ts` (no changes expected, types stay the same)
- Modify: `.env.example`
- No changes to: `src/lib/platforms/facebook/polling.ts` (broadcastToShow API stays the same)

---

### FIX-002: Rewrite client hook to use SSE with proper error handling and update console

**Status:** TODO
**Type:** BUG + CHANGE
**Severity:** CRITICAL
**Review Cycle:** 1
**Reported:** 2026-02-10

**Description:**
Replace the WebSocket client hook with an SSE-based hook using `EventSource`. Add proper error logging and connection status feedback. Update the console page to use the new hook.

Addresses:
- Issue 1: Clients will connect on the same port — no cross-port issues
- Issue 2: Proper error logging and user-facing status

**Root Cause:** `use-websocket.ts` connects to a separate port (3001) that is unreachable. Errors are silently swallowed with no logging.

**Acceptance Criteria:**
- [ ] `src/hooks/use-websocket.ts` rewritten (or replaced with `use-realtime.ts`) to use `EventSource` connecting to `/api/shows/[id]/stream`
- [ ] Auth token passed via query param or custom header (EventSource limitation: use fetch-based SSE if header auth needed)
- [ ] Connection errors logged to `console.warn` with useful context
- [ ] Reconnection with exponential backoff on disconnect
- [ ] `connected` state accurately reflects SSE connection status
- [ ] Console page (`src/app/(dashboard)/shows/[id]/console/page.tsx`) updated to use new hook
- [ ] HTTP polling fallback kept as safety net but should rarely activate
- [ ] StatusBar WiFi icon reflects actual SSE connection state
- [ ] `onEvent` callback interface unchanged — console page event handlers require minimal changes

**Files:**
- Rewrite: `src/hooks/use-websocket.ts` (rename to `use-realtime.ts` or keep name)
- Modify: `src/app/(dashboard)/shows/[id]/console/page.tsx`
- Modify: `src/components/console/status-bar.tsx` (if connection status display changes)

---

### FIX-003: Remove WebSocket dependencies and clean up artifacts

**Status:** TODO
**Type:** CHANGE
**Severity:** MEDIUM
**Review Cycle:** 1
**Reported:** 2026-02-10

**Description:**
Clean up all WebSocket-related artifacts after the SSE migration is complete.

**Acceptance Criteria:**
- [ ] `ws` package removed from `package.json` dependencies (if no longer used elsewhere)
- [ ] No remaining imports of `ws` or `WebSocketServer` in server code
- [ ] No remaining references to `WS_PORT`, `NEXT_PUBLIC_WS_URL`, or port 3001
- [ ] TypeScript compiles cleanly (`npm run typecheck`)
- [ ] Existing debug endpoint (`/api/debug/emit-comment`) still works with new event bus

**Files:**
- Modify: `package.json`
- Verify: all files in `src/lib/realtime/`
- Verify: `src/app/api/debug/emit-comment/route.ts`
