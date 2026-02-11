# Feature: audit-logging — Wire Audit Logging into Operator Actions

> **Status:** DONE
> **Created:** 2026-02-10
> **Priority:** MEDIUM

## Tasks

### TASK-001: Add audit logging to show lifecycle routes — DONE

Routes updated:
- `POST /api/shows/[id]/activate` — `show.activated`
- `POST /api/shows/[id]/pause` — `show.paused`
- `POST /api/shows/[id]/resume` — `show.resumed`
- `POST /api/shows/[id]/stop` — `show.ended`
- `DELETE /api/shows/[id]` — `show.deleted`

### TASK-002: Add audit logging to claim and item actions — DONE

Routes updated:
- `POST /api/claims/[id]/release` — `claim.released`
- `POST /api/shows/[id]/items/[itemId]/award` — `item.awarded`
- `POST /api/shows/[id]/items` — `item.created`
- `DELETE /api/shows/[id]/items/[itemId]` — `item.deleted`

All audit calls are fire-and-forget (`.catch(() => {})`).
