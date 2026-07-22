# ADR-005 – Ingest contract (HTTP snapshot sources)

**Status:** Accepted  
**Date:** 2026-07-22  
**Deciders:** Architect (package 05-ingest implementation)

## Context

Package 05 must pull camera frames into the repo’s file layout so the motion processor (package 06) and/or the notifier hub can consume them. Legacy upcam-client is Java; architecture still allows a later Java ingest path, but v0.2 needs a concrete Node-first contract.

Requirements:

- Reolink HTTP snapshot as primary source; optional UpCam adapter
- Write under `images/received/` with optional metadata sidecar JSON
- Env-first config; no secrets in files or logs
- Optional direct notify after write (`createApp().enqueueNotify`)
- No motion, ROI, zones, or browser automation in this package

## Decision

### 1. Scope boundary

Ingest **only** captures frames and writes artifacts. It does not decide motion, filter spam, or talk to Telegram/ntfy except via the optional hub call. Motion lives in package 06; delivery lives in package 01 (ADR-002).

### 2. Sources (v0.2)

| Source | Role | Transport |
|--------|------|-----------|
| Reolink | Primary | HTTP GET JPEG snapshot (timeouts, basic auth / token as configured) |
| UpCam | Optional | Adapter behind `CAMERA_TYPE=upcam` |

Selection is env-driven (`CAMERA_TYPE`, default Reolink). Unknown types fail fast at startup.

### 3. Output layout

- Target directory: configurable, default `images/received/` (gitignored runtime data).
- Image: JPEG (or source content-type) with a stable, unique filename (timestamp + camera id).
- Metadata sidecar (optional, when enabled): same basename + `.json`.

### 4. Metadata JSON schema

Minimal, secret-free fields:

```js
/**
 * @typedef {object} IngestMetadata
 * @property {string} capturedAt - ISO-8601 timestamp of capture
 * @property {string} camera - logical camera id/name from config
 * @property {string} source - e.g. "reolink" | "upcam"
 * @property {string} path - relative or absolute path of the written image
 * @property {string} [requestId] - optional correlation id for logs/tests
 */
```

No credentials, tokens, or full request URLs with auth in metadata or logs.

### 5. Runtime modes

| Mode | Behaviour |
|------|-----------|
| **files-only** (default) | Write image (+ optional JSON); exit/continue poll loop |
| **direct notify** | After successful write, call `createApp().enqueueNotify(path, caption?, metadata?)` |

Direct notify requires package 01 config; files-only must work without notifier credentials.

### 6. Implementation host for v0.2

- **Node-first**: ESM module under `src/` (poll/loop writer + HTTP clients).
- Java ingest remains an optional later alternative (parity with upcam-client), not required for package 05 acceptance.

### 7. Configuration (env-first)

Documented keys in `.env.example` only (no secrets committed):

- `CAMERA_TYPE`, poll interval, target dir
- `REOLINK_*` (base URL, auth, snapshot path/query as needed)
- `UPCAM_*` (when optional adapter is present)
- Flag or mode for direct notify vs files-only
- HTTP timeout (explicit; no unbounded waits)

Config loader reads `process.env` only (same pattern as ADR-002 / ADR-004).

### 8. Non-goals (this ADR)

- Motion detection, zones, cooldown, `filtered/` / `sent/` routing
- WhatsApp, Puppeteer, or any browser stack
- Guaranteed real-time alarm certification

## Consequences

### Positive

- Clear producer contract for package 06 (watch any `images/received/` folder).
- Reolink path is testable with mocked HTTP; no camera credentials in repo.
- Optional direct notify supports bridge/migration without full motion stack.
- Node-first unblocks v0.2 without waiting on a Java port.

### Negative / Trade-offs

- Dual-host story (Node now, Java later) may diverge until a shared metadata schema is enforced in CI.
- HTTP snapshot polling is coarser than camera push/webhooks (deferred).
- UpCam optional status may leave one legacy path under-tested.

## Alternatives considered

1. **Java-only ingest in v0.2** – rejected; Node poller delivers package 05 acceptance and matches ESM runtime already in tree.
2. **Ingest always calls notifiers** – rejected as default; couples capture to delivery and forces notifier secrets for simple folder producers.
3. **Rich event model at write time** – rejected; motion decision belongs in package 06 (ADR-006).
4. **Browser/screenshot capture** – rejected per project non-goals and ADR-003.
