# Feedback: WebSocket Realtime — Review Cycle 1

> **Feature:** websocket-realtime
> **Date:** 2026-02-10
> **Source:** user / production-testing

## Summary
- Total Issues: 3
- Bugs: 2
- Changes: 1
- Enhancements: 0

## Issues

### Issue 1: WebSocket clients never connect — 0/0 clients on every broadcast
**Type:** BUG
**Severity:** CRITICAL

**Description:**
Server logs prove that broadcasts are being sent to **0/0 clients** every time. The WS server is running and is the owner process (log prefix is "Broadcast" not "Relay"), but no browser clients are successfully connecting. The polling fallback (3-second HTTP re-fetch) kicks in as the sole data delivery mechanism, meaning the console is never truly real-time.

**Evidence from logs:**
```
[WS] Broadcast comment.received to 0/0 clients for show 275729c7...
[WS] Broadcast claim.created to 0/0 clients for show 275729c7...
```

Meanwhile, the HTTP polling fallback IS running:
```
GET /api/shows/275729c7.../claims 200 in 75ms
GET /api/shows/275729c7.../comments?limit=200 200 in 71ms
```

**Root Cause Analysis:**
The standalone WS server architecture (`src/lib/realtime/server.ts`) runs on a separate port (default 3001) from the Next.js app (port 3000). The client (`src/hooks/use-websocket.ts`) connects to `ws://localhost:3001/api/realtime?...`.

Multiple issues compound here:
1. **Lazy initialization**: `ensureServer()` is only called from `broadcastToShow()`, meaning the WS server doesn't start until the first comment is polled. If the client connects before any comment arrives, the connection fails with no server listening.
2. **Port accessibility**: Running in WSL2 (`Linux 6.6.87.2-microsoft-standard-WSL2`), the separate port 3001 may not be forwarded to the Windows host browser. Port 3000 works because Next.js is the primary dev server, but port 3001 is a side-process with no guarantee of network visibility.
3. **Silent failure**: `ws.onerror` in the client just calls `ws.close()` with no logging. The reconnect loop runs silently with exponential backoff, so the user sees no error — just a dead real-time feed.
4. **The architecture requires two separate servers** (Next.js on 3000, WS on 3001), increasing deployment complexity and failure modes.

**Steps to Reproduce:**
1. Start the dev server (`npm run dev`)
2. Open a show console page
3. Start the show (activate polling)
4. Comment "sold 101" on the live video
5. Observe server logs show `0/0 clients` on broadcast
6. UI only updates via 3-second HTTP polling fallback, not instantly

**Expected:** WebSocket connects successfully, broadcasts delivered to 1+ clients, UI updates instantly on new comments/claims.
**Actual:** 0 clients ever connect. All data delivery happens via 3-second polling fallback. No real-time updates.

---

### Issue 2: No error visibility when WebSocket connection fails
**Type:** BUG
**Severity:** HIGH

**Description:**
The `use-websocket.ts` hook silently swallows all WebSocket errors. When the connection to port 3001 fails, the `onerror` handler just calls `ws.close()` and the `onclose` handler triggers a silent reconnect. There is zero console logging, no user-facing error, and no way to diagnose the problem from the browser.

The `getAccessToken()` call in `connect()` also silently returns `null` if no token is found, causing the entire connection attempt to silently abort.

**File:** `src/hooks/use-websocket.ts:56-58`
```typescript
ws.onerror = () => {
  ws.close();
};
```

**Expected:** Connection failures should be logged to the browser console for debugging. Persistent failure should be surfaced to the user (e.g., "Real-time connection failed, using polling fallback").
**Actual:** Complete silence. User only sees a WifiOff icon in the status bar with no explanation.

---

### Issue 3: Architecture needs simplification — eliminate separate WS port
**Type:** CHANGE
**Severity:** CRITICAL

**Description:**
The current design runs a standalone WebSocket server on a separate port (3001) alongside the Next.js server (3000). This creates multiple failure modes:

1. **Two ports to manage** — firewall rules, WSL2 forwarding, Docker port mapping, reverse proxy config all need to handle both ports
2. **Race condition on startup** — WS server starts lazily on first broadcast, not on app boot
3. **Multi-worker complexity** — the owner/relay pattern (`broadcastToShow` → `ensureServer` → owner check → HTTP relay) adds fragile indirection
4. **EADDRINUSE silent fallback** — if port 3001 is taken, the server silently switches to relay mode pointing at a potentially dead endpoint

The recommended fix is to **replace the standalone WS server with a Next.js-integrated approach**. Options:
- **Option A**: Use a Next.js custom server that handles WS upgrades on the same port (3000)
- **Option B**: Replace WebSocket with Server-Sent Events (SSE) via a standard Next.js API route — simpler, works over HTTP, no separate port needed
- **Option C**: Use the Next.js `instrumentation.ts` hook or `next.config.ts` server setup to start the WS server eagerly on app boot, and ensure it's on the same origin

The goal: **single port, single server, no relay complexity, works everywhere out of the box**.
