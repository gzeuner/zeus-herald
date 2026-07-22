# Architecture – zeus-herald

## Principles

1. **Reliability over cleverness** – official APIs only (Telegram Bot API, ntfy HTTP).
2. **Pluggable notifiers** – one interface, many adapters.
3. **Observable** – structured health, decision logs, metrics.
4. **Resource-conscious** – no headless browsers, explicit buffer disposal.
5. **Autonomous-friendly** – clear packages, ADRs, role contracts so agents can work without constant human intervention.

## Components (target)

| Component | Responsibility | Tech (initial) |
|-----------|----------------|----------------|
| Ingest | Pull snapshots from camera, pre-filter, write files + metadata | Java 21 (ported from upcam-client) or later Go/Python |
| Processor | Watch / receive frames, motion & zone logic, event state machine | Node.js 20+ (ported & cleaned from SnapShotter) |
| Notifier Hub | Dispatch accepted events to one or more channels | Node.js – Telegram + ntfy first |
| Runtime Supervisor | Health, queues, recovery actions, sample archive | Shared |
| Config & Secrets | Env-first, no secrets in git | dotenv / env vars |

## Notifier Interface (contract)

```ts
interface Notifier {
  readonly name: string;
  send(payload: { imagePath: string; caption?: string; metadata?: object }): Promise<SendResult>;
  health(): Promise<{ ok: boolean; detail?: string }>;
}
```

At least one successful notifier is required for an event to be considered “delivered”.  
Failures of individual notifiers are logged but do not block others.

## Data flow

```
Camera → Ingest → received/ + .json metadata
                → Processor (motion/event)
                → pending/ (if send)
                → Notifier Hub
                → sent/  (success)  |  filtered/ (no send)
```

## Non-goals (v1)

- WhatsApp / any browser automation
- Multi-tenant SaaS features
- Guaranteed real-time alarm system certification
- Heavy ML models (optional later as score booster)

## Evolution

- Phase 0–1: Clean notifier cut-over (this roadmap)
- Later: optional single-binary rewrite, camera webhooks, richer event model, optional lightweight object detection
