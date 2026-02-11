# Feature: websocket-realtime — Fix Real-Time Event Delivery

> **Status:** DONE
> **Created:** 2026-02-10
> **Priority:** CRITICAL — Blocks core product functionality

## Context

The live operator console was not receiving real-time updates. Server-side polling and claim processing worked correctly, but the WebSocket delivery to the browser was completely broken. Server logs showed `0/0 clients` on every broadcast. The UI fell back to 3-second HTTP polling.

**Root cause:** Standalone WebSocket server on separate port (3001) never received client connections — lazy init, WSL2 port isolation, silent errors.

**Fix:** Replaced WebSocket with Server-Sent Events (SSE) over regular Next.js API routes. Same port, same origin, works everywhere.

---

## Review Cycle 1

### FIX-001: Replace standalone WS server with SSE event bus and streaming endpoint

**Status:** DONE
**Type:** CHANGE (architectural rewrite)
**Severity:** CRITICAL

**Changes:**
- `src/lib/realtime/server.ts` — Rewritten from 237-line standalone WS server to 47-line EventEmitter pub/sub. `broadcastToShow()` API unchanged — zero changes needed in polling worker or any other caller.
- `src/app/api/shows/[id]/stream/route.ts` — New SSE endpoint. Authenticates via JWT query param, subscribes to EventEmitter, streams events as SSE `data:` frames with 15s heartbeat.
- `.env.example` — Removed `WS_PORT` and `NEXT_PUBLIC_WS_URL`

---

### FIX-002: Rewrite client hook to use SSE with proper error handling

**Status:** DONE
**Type:** BUG + CHANGE
**Severity:** CRITICAL

**Changes:**
- `src/hooks/use-websocket.ts` — Rewritten from WebSocket to `EventSource`. Connects to `/api/shows/{id}/stream` (same origin, port 3000). Errors logged to console. `EventSource` has built-in auto-reconnect with backoff.
- `src/app/(dashboard)/shows/[id]/console/page.tsx` — Updated import from `useWebSocket` to `useRealtime`. All event handlers unchanged.

---

### FIX-003: Remove WebSocket dependencies and clean up artifacts

**Status:** DONE
**Type:** CHANGE
**Severity:** MEDIUM

**Changes:**
- `package.json` — Removed `ws` from dependencies, `@types/ws` from devDependencies
- No remaining imports of `ws` or `WebSocketServer` anywhere in codebase
- Debug endpoint (`/api/debug/emit-comment`) unchanged — still calls `broadcastToShow()` which works with the new EventEmitter
