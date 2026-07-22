# Package 03 – Runtime Hardening

## Goal
Make the long-running process production-grade: queues, health, memory discipline, observability.

## Tasks

1. Keep / refine RuntimeSupervisor (RSS, queue depths, decision log, sample archive).
2. Explicit buffer / stream disposal after sharp / file operations.
3. Bounded queues + drop or retry policy under back-pressure.
4. Structured logging (already present – align levels).
5. Heartbeat that also probes notifier health.
6. Graceful SIGINT/SIGTERM with lock release.
7. Tester: soak test (several hundred frames) + leak check.

## Acceptance

- [ ] No unbounded growth of Maps / buffers under continuous load
- [ ] Health file remains accurate
- [ ] Process survives 24 h dry-run equivalent without restart
- [ ] Reviewer + Tester sign-off
