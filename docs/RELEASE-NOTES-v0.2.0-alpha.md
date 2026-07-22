# Release notes – v0.2.0-alpha

**Date:** 2026-07-22  
**Tag:** `v0.2.0-alpha`  
**Status:** alpha – ingest + motion pipeline usable; tune thresholds on real cameras

## Highlights

- **Package 05 – Ingest:** Reolink (primary) + optional UpCam HTTP snapshot → `images/received/` + optional metadata JSON  
  - Modes: `files_only` (default) or `direct_notify` via hub  
  - CLI: `npm run ingest` / `INGEST_ONCE=1`
- **Package 06 – Motion:** Decision `{ send, reason, metrics }` with confirm / cooldown / max sends, brightness + delta gates  
  - Folders: `received` → `filtered` | `sent` (+ `.decision.json`)  
  - Notify **only** through Notifier Hub  
  - CLI: `npm run motion` / `MOTION_ONCE=1`
- **E2E (CI-safe):** fixture frames through writer + motion + mock notify (`test/e2e-pipeline.test.js`)
- **ADRs:** ADR-005 (ingest), ADR-006 (motion) **Accepted**
- **Docs:** README pipeline + env matrix; MIGRATION full-stack path

## Still simplified / known limits

- Motion delta is a **byte-sample heuristic** (no full JPEG decode / Sharp) — good for fixtures; tune or extend for production scenes
- Not full SnapShotter parity (zones/ROI are env-level fractions, not visual editor)
- No published npm package / container image

## Upgrade / install

```bash
git fetch --tags
git checkout v0.2.0-alpha
cp .env.example .env
# set TELEGRAM_* and/or NTFY_URL
# set REOLINK_* or drop JPEGs into images/received/
npm test
# terminal A:
npm run ingest
# terminal B:
npm run motion
```

See `README.md` and `docs/MIGRATION.md`.

## Tag checklist

- [x] ADR-005 / ADR-006 Accepted
- [x] Packages 05–06 implemented + unit tests
- [x] E2E mock pipeline test green
- [x] README + MIGRATION updated
- [x] Release notes this file
- [ ] `git tag -a v0.2.0-alpha` (Coordinator after commit)
- [ ] `git push origin main` + `git push origin v0.2.0-alpha` (on request)
- [ ] Optional: `gh release create v0.2.0-alpha --prerelease --notes-file docs/RELEASE-NOTES-v0.2.0-alpha.md`
