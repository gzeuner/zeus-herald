# Package 01 – Notifier Core

## Goal
Implement the pluggable Notifier interface and the first two concrete adapters (Telegram Bot + ntfy).

## Tasks

1. Architect: finalize Notifier interface + SendResult shape (ADR-002).
2. Implementer: create `src/notifiers/base.js` (or .ts), `telegram.js`, `ntfy.js`, `index.js` (factory).
3. Implementer: wire factory into a thin `sendAcceptedFrame(imagePath, caption, metadata)` entry point.
4. Config: `notifier.telegram` + `notifier.ntfy` sections (env-first).
5. Tester: unit tests for both adapters (mock fetch) + one integration smoke test (optional, behind env flag).
6. Reviewer: security (no token logging), error handling, timeout behaviour, no shared mutable state.

## Acceptance

- [ ] Both notifiers can be enabled/disabled independently
- [ ] At least one success → overall success
- [ ] Failures are isolated and logged
- [ ] Health checks implemented
- [ ] Reviewer + Tester sign-off

## Out of scope
Removing WhatsApp code (→ package 02)
