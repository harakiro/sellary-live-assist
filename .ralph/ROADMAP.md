# Sellary Live Assist — Roadmap

Generated from PRD.md analysis against current codebase state.

## Current State Assessment

Milestones 0–4 from the PRD are **largely complete**. The backend API, claim engine, allocation logic, WebSocket server, OAuth flows, FB polling, and IG webhook processing are all implemented. However, several UI pages are placeholders that don't fetch real data, a key API endpoint is missing, and hardening/polish work remains.

---

## Phase 1: Foundation Completion (HIGH Priority)

These are gaps in already-"complete" milestones that block basic usability.

### Feature 1.1: Wire Up Dashboard UI Pages
**Priority:** HIGH | **Depends:** None
**Status:** COMPLETE

The Shows list page (`/shows`) is a static placeholder showing "No shows yet" without fetching from the API. The Dashboard page shows static cards. These pages need to fetch real data and display it.

**Gaps identified:**
- `/shows` page: hardcoded empty state, never calls `GET /api/shows`
- Dashboard page: static cards, no live data (show counts, recent activity)

### Feature 1.2: Live Discovery Endpoint
**Priority:** HIGH | **Depends:** 1.1
**Status:** NOT STARTED

The `GET /api/connections/:id/lives` endpoint is referenced in the PRD (Section 5.2, step 4: "Detect Active Lives") but not implemented. Without it, operators cannot discover active broadcasts from within the app — they'd have to paste Live Video IDs manually.

### Feature 1.3: Show Detail & Activation Polish
**Priority:** HIGH | **Depends:** 1.2
**Status:** NOT STARTED

The show detail page exists but the activation flow needs the live discovery endpoint wired in. Currently operators have no way to select a detected live broadcast from the UI. The "Detect Active Lives" button needs to call the lives endpoint and present results for selection.

---

## Phase 2: Integrations & Checkout (HIGH Priority — Upsell Feature)

Third-party integrations framework with Stripe as the first provider. Designed as a monetizable upsell feature.

### Feature 2.0: Stripe Integration & Integrations Framework
**Priority:** HIGH | **Depends:** None (isolated from Phase 1 work)
**Status:** IN PROGRESS

Full integrations framework with Stripe as the first adapter. Enables invoice generation from show claims and checkout link delivery. Designed with pluggable adapter pattern for future Shopify/Square/MedusaJS integrations.

**Architecture:** [ARCH_stripe-integration.md](.ralph/architecture/ARCH_stripe-integration.md)
**Tasks:** [FEAT_stripe-integration.md](.ralph/features/FEAT_stripe-integration.md)

**Key deliverables:**
- Integrations data model (integrations + invoices tables)
- Stripe adapter (BYOK keys + OAuth connection)
- Invoice generation engine (claims → Stripe invoices)
- Stripe webhook handler (payment status tracking)
- Integrations Hub UI (/integrations page)
- Invoice management UI on show detail page

---

## Phase 3: Hardening & Quality (MEDIUM Priority)

Maps to PRD Milestone 5.

### Feature 3.1: Audit Logging
**Priority:** MEDIUM | **Depends:** None
**Status:** NOT STARTED

`src/lib/audit.ts` exists but audit log entries are not being written on operator actions (release, award, pause, stop, etc.). The `audit_log` table exists in the schema.

### Feature 3.2: Auth Rate Limiting
**Priority:** MEDIUM | **Depends:** None
**Status:** NOT STARTED

PRD NFR4 requires rate limiting on auth endpoints. No rate limiting is currently implemented.

### Feature 3.3: Settings Persistence
**Priority:** MEDIUM | **Depends:** None
**Status:** NOT STARTED

The Settings page UI exists but the `PATCH /api/workspaces/:id` endpoint needs verification/completion. Workspace settings (claim word defaults, polling interval) need to persist.

### Feature 3.4: Error Handling & Edge Cases
**Priority:** MEDIUM | **Depends:** 3.1
**Status:** NOT STARTED

Graceful handling of network interruptions, token expiration during active shows, WebSocket reconnection with missed event catch-up via REST.

---

## Phase 4: Testing & Reliability (MEDIUM Priority)

### Feature 4.1: Integration Test Suite
**Priority:** MEDIUM | **Depends:** Phase 1
**Status:** NOT STARTED

Integration tests for: concurrent claim allocation, waitlist promotion, full show lifecycle, WebSocket event delivery. Test against real database.

### Feature 4.2: E2E Test Suite
**Priority:** MEDIUM | **Depends:** Phase 1
**Status:** NOT STARTED

Playwright tests for: registration → login → create show → add items → activate → claims via debug endpoint → summary → export.

### Feature 4.3: Debug Endpoint Completion
**Priority:** LOW | **Depends:** None
**Status:** NOT STARTED

`POST /api/debug/bulk-comments` and `POST /api/debug/emit-ig-webhook` may need implementation or completion for testing workflows.

---

## Phase 5: Post-MVP (LOW Priority — Future)

From PRD Section 15. Not planned for current build cycle.

- 5.1: Automated comment replies (FB)
- 5.2: Additional checkout integrations (Shopify, Square, MedusaJS adapters)
- 5.3: Advanced claim parsing (AI/LLM, multi-variant)
- 5.4: TikTok Live integration
- 5.5: Mobile app

---

## Dependency Graph

```
1.1 (Wire UI) ✅ ──► 1.2 (Live Discovery) ──► 1.3 (Activation Polish)
                                                      │
                                                      ▼
                                               4.1 (Integration Tests)
                                               4.2 (E2E Tests)

2.0 (Stripe Integration) ◄── Isolated, parallel track
  FEAT-001 ──► FEAT-002 ──► FEAT-003 ──► FEAT-005
                  │                          │
                  └──► FEAT-004 ────────────┘
                  FEAT-003 ──► FEAT-006

3.1 (Audit) ──► 3.4 (Error Handling)
3.2 (Rate Limit)
3.3 (Settings)
```
