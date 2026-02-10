# Architecture: Wire Up Dashboard UI Pages

## Overview

The backend API is complete (`GET /api/shows` returns shows scoped to workspace). The frontend pages for the shows list and dashboard are static placeholders that never call the API. This feature wires them up to display real data.

## Component Design

### Shows List Page (`/shows`)

**Current state:** Hardcoded "No shows yet" message, no API call.

**Target state:**
- Fetch `GET /api/shows` on mount using `apiFetch`
- Display shows in a table/card list with: name, status badge, item count, created date
- Each row links to `/shows/{id}`
- Loading spinner while fetching
- Empty state when genuinely no shows exist
- "New Show" button already exists (keep it)

**Pattern to follow:** Same `useState` + `useEffect` + `apiFetch` pattern used in `shows/[id]/page.tsx`.

### Dashboard Page (`/dashboard`)

**Current state:** Static cards with links to Shows and Connections.

**Target state:**
- Fetch `GET /api/shows` to get recent shows and counts
- Show summary stats: total shows, active shows, total claims across recent shows
- Recent shows list (last 3-5) with quick links
- Keep existing "New Show" and "Manage Connections" cards

## Data Flow

```
Browser                    API                    Database
  │                         │                        │
  ├── GET /api/shows ──────►│── SELECT from shows ──►│
  │                         │   WHERE workspace_id   │
  │◄── { data: Show[] } ───┤◄──────────────────────│
  │                         │                        │
  └── render list ──────────┘                        │
```

## API Endpoints Used

| Endpoint | Status | Notes |
|----------|--------|-------|
| `GET /api/shows` | COMPLETE | Returns shows with `desc(createdAt)` ordering |
| `GET /api/shows/:id` | COMPLETE | Returns show with items and stats |

No new API endpoints needed. The existing endpoints return all required data.

## Technical Decisions

1. **No new components needed** — the shows list fits directly in the page component following existing patterns.
2. **No new hooks needed** — `apiFetch` handles auth and refresh.
3. **Status badge reuse** — use the `statusBadgeVariant` helper pattern from show detail page.
4. **Relative time formatting** — use simple date formatting consistent with existing codebase (no new dependencies).
