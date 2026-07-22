# Package 06 – Motion

## Goal
Watch or accept frames from `images/received/`, decide motion with simplified SnapShotter-like rules (delta / ROI / zones / brightness / event cooldown), and on accept call `createApp().enqueueNotify`. Route rejects to `filtered/`, accepts to `sent/`.

## Tasks

1. Architect: ADR for decision shape `{ send, reason, metrics }` and folder contract (`received` → `filtered` | `sent`).
2. Implementer: frame input – directory watcher and/or push API (standalone on any folder).
3. Implementer: motion pipeline – pixel/delta threshold, ROI crop, zones, brightness gate, event cooldown (behaviour-near SnapShotter, simplified).
4. Implementer: on `send: true` → `createApp().enqueueNotify(path, caption, metadata)`; on reject → move/copy to `filtered/` with reason.
5. Implementer: accepted frames archived under `sent/` after notify enqueue (or policy documented).
6. Config: env-first thresholds, zones, cooldown, paths.
7. Tester: synthetic before/after frames (no-motion / motion / brightness / cooldown).
8. Reviewer: no unbounded buffer growth; no browser; decision log is structured and secret-free.

## Acceptance

- [ ] Decision object always includes `send`, `reason`, `metrics`
- [ ] `send: true` enqueues notify via package 01
- [ ] Rejects land in `filtered/`; accepts tracked under `sent/`
- [ ] Runs standalone on a folder without package 05
- [ ] Cooldown and brightness gates suppress obvious spam
- [ ] Reviewer + Tester sign-off

## Depends on
- `01-notifier-core` (required)
- `05-ingest` (optional – can run on any `images/received/` producer)

## Out of scope
Camera HTTP clients (→ package 05). Full SnapShotter parity / ML. Browser stack. WhatsApp.

## How to verify
```bash
npm test -- --grep motion

# drop two JPEGs into images/received/ (static vs changed ROI)
# expect: one filtered, one sent + enqueueNotify path exercised (mock hub OK)
```
