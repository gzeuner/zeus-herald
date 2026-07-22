# ADR-004 – Runtime hardening (queues, health, shutdown)

**Status:** Accepted  
**Date:** 2026-07-22  
**Deciders:** Architect (package 03-runtime-hardening)

## Context

Notifier hub (package 01) is correct but not yet a long-running production process. Legacy SnapShotter used an elaborate RuntimeSupervisor tied to WhatsApp recovery. zeus-herald needs a **simpler** supervisor: bounded work, health file, heartbeat with notifier probes, graceful signals — without browser recovery paths.

## Decision

### 1. BoundedQueue

- Fixed `maxSize` (default 100, env `QUEUE_MAX_SIZE`).
- Policy via `QUEUE_DROP_POLICY`: `drop_oldest` | `reject` (default `drop_oldest`).
- Serial drain: one task at a time to avoid unbounded parallel send storms.
- Metrics: depth, enqueued, dropped, processed, errors.

### 2. RuntimeSupervisor

- In-memory counters + optional JSON health file under `state/health.json` (gitignored via `state/`).
- Records: startedAt, lastHeartbeatAt, lastSendOkAt, lastSendFailAt, rssBytes, queue metrics, notifier health snapshot.
- `writeHealth()` atomic write (temp + rename).
- Decision log append-only lines to `logs/decisions.ndjson` when enabled (optional, env `DECISION_LOG=1`).

### 3. Heartbeat

- Interval `HEARTBEAT_MS` (default 60000).
- On each tick: sample `process.memoryUsage()`, probe hub `health()`, write health file.
- Does not throw; failures logged.

### 4. Graceful shutdown

- Listen SIGINT / SIGTERM once.
- Stop accepting new enqueue, wait for queue idle with timeout (`SHUTDOWN_TIMEOUT_MS`, default 15000).
- Clear heartbeat timers; final health write with `status: stopping|stopped`.
- Exit code 0 on clean stop, 1 on timeout/error.

### 5. Buffer discipline

- No global image caches.
- Notifiers read file → send → drop local Buffer references (already GC-eligible after send returns).
- Queue stores job descriptors (paths + captions), not image buffers.

### 6. Out of scope for this package

- Full motion/event pipeline and sample archive taxonomy (later ingest/processor packages).
- 24h live soak in CI (provide a short synthetic soak test instead).

## Consequences

### Positive

- Back-pressure is explicit; process cannot grow pending work without bound.
- Operators get a health file and structured logs.
- Clean stop without orphaned intervals.

### Negative / Trade-offs

- `drop_oldest` may discard events under overload (documented; prefer reliability of the process).
- Health file is best-effort local JSON, not a remote metrics backend.

## Alternatives considered

1. **Port full SnapShotter RuntimeSupervisor** – too many WhatsApp-specific recovery hooks.
2. **Unbounded Promise queue** – fails acceptance (unbounded growth).
3. **External Redis queue** – operational overkill for single-camera personal use.
