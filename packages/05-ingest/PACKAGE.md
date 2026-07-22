# Package 05 – Ingest

## Goal
Capture camera frames (Reolink HTTP snapshot primary; optional UpCam) and write them under `images/received/` with optional metadata JSON. Env-first config; no motion logic, no browser.

## Tasks

1. Architect: ADR for ingest sources + config keys (`CAMERA_TYPE`, `REOLINK_*`, `UPCAM_*`, poll interval, target dir).
2. Implementer: Reolink snapshot client (HTTP GET JPEG, timeouts, basic auth / token as needed).
3. Implementer (optional): UpCam adapter behind `CAMERA_TYPE=upcam`.
4. Implementer: poll/loop writer → `images/received/` (+ optional sidecar `.json` metadata: camera, timestamp, source).
5. Config: env-first only; document keys in `.env.example`.
6. Mode switch: **files-only** (default) vs **direct notify** (`createApp().enqueueNotify` after write).
7. Tester: unit tests with mocked HTTP; smoke dry-run writes into a temp dir.
8. Reviewer: no secrets in logs, no browser deps, timeouts + error isolation.

## Acceptance

- [ ] Reolink snapshot path works with env config alone
- [ ] Frames land in configured `images/received/` (gitignored)
- [ ] Optional metadata JSON is written when enabled
- [ ] Direct-notify mode optional; files-only works without notifier config
- [ ] No motion / ROI / browser code in this package
- [ ] Reviewer + Tester sign-off

## Depends on
- `00-foundation` (required)
- `01-notifier-core` (optional – only for direct notify mode)

## Out of scope
Motion detection, zones, cooldown, filtered/sent layout (→ package 06). Browser automation. Production camera credentials in repo.

## How to verify
```bash
# mocked unit tests
npm test -- --grep ingest

# dry-run: set CAMERA_TYPE + REOLINK_* against a fixture HTTP server or camera
# confirm JPEG (+ optional JSON) under images/received/
```
