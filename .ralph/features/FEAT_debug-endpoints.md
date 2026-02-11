# Feature: debug-endpoints — Debug Endpoint Completion

> **Status:** DONE (already implemented)
> **Created:** 2026-02-10
> **Priority:** LOW

All three debug endpoints already exist and are functional:

1. `POST /api/debug/emit-comment` — Single comment simulation
2. `POST /api/debug/bulk-comments` — Batch comment simulation with delays
3. `POST /api/debug/emit-ig-webhook` — Instagram webhook simulation

All are gated behind `NODE_ENV !== 'production'`.
