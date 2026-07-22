# Package 07 – Integration & Docs

## Goal
Prove end-to-end Ingest → Motion → Notifier, finish docs (README + MIGRATION), finalize ADR-005/006, prepare tag `v0.2.0-alpha`.

## Tasks

1. Integration path: run 05 (or folder fixture) → 06 → `enqueueNotify` → Telegram/ntfy (or mocks in CI).
2. Document pipeline diagram and env matrix in root `README.md`.
3. Update `docs/MIGRATION.md` for full stack (ingest + motion vs notify-only bridge).
4. Architect: finalize ADR-005 (ingest) and ADR-006 (motion) as Accepted.
5. Release prep: `docs/RELEASE-NOTES-v0.2.0-alpha.md` (or section); tag checklist for `v0.2.0-alpha`.
6. Tester: E2E smoke (local) + CI-safe integration with mocks.
7. Coordinator: mark packages 05–07 DONE when acceptance green.

## Acceptance

- [ ] Documented E2E path works on a clean clone + `.env`
- [ ] README covers install, env vars, ingest/motion/notify modes
- [ ] MIGRATION reflects SnapShotter → zeus-herald full pipeline
- [ ] ADR-005 and ADR-006 finalized
- [ ] Tag `v0.2.0-alpha` ready (notes + checklist); Coordinator sign-off

## Depends on
- `05-ingest`
- `06-motion`
- (implicit: `00-foundation`, `01-notifier-core`)

## Out of scope
New features beyond wiring 05+06. Production deploy / containers (optional later). Legacy repo edits unless still owned.

## How to verify
```bash
npm test
# optional live: CAMERA_* + TELEGRAM_* / NTFY_* → one real notification after motion frame
# docs: walk README zero-to-first-image including motion mode
```
