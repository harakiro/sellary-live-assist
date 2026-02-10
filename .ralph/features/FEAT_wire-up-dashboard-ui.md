# Feature: Wire Up Dashboard UI Pages

**Feature ID:** wire-up-dashboard-ui
**Priority:** HIGH
**Phase:** 1 — Foundation Completion

## Summary

The Shows list page and Dashboard page are static placeholders. Wire them up to fetch real data from the existing API endpoints and display shows, stats, and navigation.

---

### FEAT-001: Wire up Shows list page to fetch and display shows

**Status:** TODO
**Depends:** (none)
**Size:** M

**Description:**
Replace the static "No shows yet" placeholder in `src/app/(dashboard)/shows/page.tsx` with a real data-fetching page. Fetch shows from `GET /api/shows` on mount, display them in a list with name, status badge, item count, and created date. Each show links to its detail page. Include loading state and empty state. Follow the same `useState` + `useEffect` + `apiFetch` pattern used in `shows/[id]/page.tsx`.

**Acceptance Criteria:**
- [ ] Page fetches from `GET /api/shows` on mount
- [ ] Shows display with name, status badge, and created date
- [ ] Each show row/card links to `/shows/{id}`
- [ ] Loading spinner shown while fetching
- [ ] Empty state shown only when API returns zero shows
- [ ] "New Show" button still present and functional

**Files:**
- Modify: `src/app/(dashboard)/shows/page.tsx`

---

### FEAT-002: Wire up Dashboard page with live stats and recent shows

**Status:** TODO
**Depends:** FEAT-001
**Size:** M

**Description:**
Enhance the Dashboard page to fetch show data and display summary stats (total shows, active shows count) and a recent shows list. Fetch `GET /api/shows` and compute stats client-side. Show the 5 most recent shows with status and quick link to detail. Keep existing "New Show" and "Manage Connections" cards.

**Acceptance Criteria:**
- [ ] Dashboard fetches show data on mount
- [ ] Displays total shows count and active shows count
- [ ] Shows list of 5 most recent shows with name, status, and link
- [ ] Loading state while fetching
- [ ] Existing navigation cards preserved

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

---

### FEAT-003: Add show delete capability from shows list

**Status:** TODO
**Depends:** FEAT-001
**Size:** M

**Description:**
Add ability to delete draft shows from the shows list. Add a `DELETE /api/shows/:id` handler that only allows deleting shows in `draft` status (with no claims). Add a delete button/menu on each draft show in the list page with a confirmation prompt.

**Acceptance Criteria:**
- [ ] DELETE endpoint validates show is in draft status
- [ ] DELETE endpoint removes show and its items
- [ ] Delete button visible only on draft shows in the list
- [ ] Confirmation prompt before deletion
- [ ] List refreshes after successful delete

**Files:**
- Modify: `src/app/api/shows/[id]/route.ts` (add DELETE handler)
- Modify: `src/app/(dashboard)/shows/page.tsx` (add delete UI)

---

## Task Order

1. FEAT-001 — Shows list (unblocks everything else)
2. FEAT-002 — Dashboard stats (depends on pattern from FEAT-001)
3. FEAT-003 — Show delete (enhances the list from FEAT-001)
