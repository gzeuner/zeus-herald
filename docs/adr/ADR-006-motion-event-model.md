# ADR-006 – Motion event model and folder contract

**Status:** Proposed  
**Date:** 2026-07-22  
**Deciders:** Architect (v0.2 planning)

## Context

Package 06 must turn frames under `images/received/` into send-or-drop decisions without reintroducing SnapShotter’s browser/WhatsApp stack. The notifier hub (ADR-002) already exposes `createApp().enqueueNotify`; motion must use that path only.

Requirements:

- Decision shape: `{ send, reason, metrics }`
- Event state: confirm, cooldown, max sends (simplified SnapShotter-like)
- Folder flow: `received` → `filtered` | `sent`
- Notify only via Notifier Hub; no direct HTTP to Telegram/ntfy from motion
- Env-first thresholds; no secrets in decision logs
- Runnable standalone on any producer folder (package 05 optional)

## Decision

### 1. Pipeline position

```
images/received/  →  Motion decision  →  send:true  →  enqueueNotify →  images/sent/
                                      →  send:false →  images/filtered/
```

Ingest (ADR-005) is a producer only. Motion owns accept/reject routing and event suppression.

### 2. Decision object

Every evaluated frame yields a decision (never silent drop without reason):

```js
/**
 * @typedef {object} MotionDecision
 * @property {boolean} send - whether to enqueue notification
 * @property {string} reason - stable machine-oriented code (e.g. "motion", "no_delta", "cooldown", "brightness", "max_sends")
 * @property {Record<string, unknown>} metrics - numeric/debug fields (thresholds, scores, timings); secret-free
 */
```

Caption/metadata for notify may be derived from decision + ingest sidecar, but the core contract is `send` / `reason` / `metrics`.

### 3. Event state (simplified SnapShotter-like)

Stateful machine over time/camera (not per-frame pure function only):

| Concept | Intent |
|---------|--------|
| **Confirm** | Require N consecutive (or windowed) positive samples before first send |
| **Cooldown** | After a send (or event end), suppress further sends for a configured interval |
| **Max sends** | Cap notifications per event/window to limit spam |

Exact thresholds and window sizes are env-configured. Behaviour should be recognizably SnapShotter-like but **simplified**—no full parity, no ML requirement for v0.2.

Supporting gates (implementation detail, still in scope of the model):

- Frame/pixel delta threshold
- Optional ROI crop and zones
- Brightness gate (reject useless dark/overexposed frames)

### 4. Folder contract

| Folder | Meaning |
|--------|---------|
| `images/received/` | Input queue (ingest or external writer) |
| `images/filtered/` | Rejects (`send: false`); retain reason in log and/or sidecar |
| `images/sent/` | Accepts after notify enqueue (archive policy: move/copy as implemented; document one policy) |

Paths configurable via env; defaults under gitignored `images/`. Processor must not grow unbounded buffers; process or park files and release resources.

### 5. Notify boundary

- **Only** `createApp().enqueueNotify(imagePath, caption?, metadata?)` (or equivalent hub surface from package 01).
- Motion must **not** call Telegram/ntfy HTTP clients, open browser sessions, or embed WhatsApp/Puppeteer.
- Notify failures are hub concerns (logging, `SendResult`); motion still archives under `sent/` per documented policy after enqueue, or records enqueue failure without inventing a second delivery channel.

### 6. Input modes

- Directory watcher and/or push API over the same decision path.
- Standalone: any folder of JPEGs is valid input (no hard dependency on package 05).

### 7. Configuration & observability

- Env-first: thresholds, ROI/zones, confirm count, cooldown, max sends, paths.
- Structured decision logs: `send`, `reason`, key `metrics`; never tokens or full secret-bearing URLs.

### 8. Non-goals (this ADR)

- Camera HTTP clients (ADR-005 / package 05)
- Full SnapShotter parity or heavy ML detectors
- WhatsApp / Puppeteer / browser automation (ADR-003)

## Consequences

### Positive

- Single decision shape for tests, logs, and future dashboards.
- Spam control (confirm / cooldown / max sends) without browser stack.
- Clear separation: capture vs decide vs deliver.
- Standalone folder mode eases migration from upcam-client / fixtures.

### Negative / Trade-offs

- Simplified state machine may miss edge cases of legacy SnapShotter.
- `sent/` after enqueue (not after remote ACK) can archive frames whose notify ultimately failed—acceptable if hub logs failures; stricter “sent only on `ok`” can be a later policy flip.
- Pixel/delta heuristics remain lighting-sensitive; zones/ROI mitigate but need tuning.

## Alternatives considered

1. **Ingest decides motion** – rejected; couples camera I/O to event policy and blocks standalone folder processing.
2. **Direct HTTP notify from motion** – rejected; bypasses hub isolation, enablement matrix, and safe logging (ADR-002).
3. **Full SnapShotter port** – rejected for v0.2 scope; adopt simplified confirm/cooldown/max-sends only.
4. **WhatsApp / Puppeteer delivery** – rejected project-wide (ADR-003).
