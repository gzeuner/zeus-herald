# Release notes – v0.1.0

**Date:** 2026-07-22  
**Tag:** `v0.1.0`

## Highlights

- Greenfield **zeus-herald** repository: ESM Node 20+, MIT license, CI skeleton
- **Notifier hub** with Telegram Bot (`sendPhoto`) and ntfy (HTTP PUT image)
- Overall delivery success if **≥1** channel succeeds; isolated failures
- **Env-first** config, secret redaction in structured JSON logs
- **Runtime:** bounded serial queue, health file, heartbeat + notifier probe, SIGINT/SIGTERM
- **Hard ban** on WhatsApp / Puppeteer / Playwright (automated check in `npm test`)
- ADRs 001–004 and migration / discontinuation docs

## Not in this release

- Full camera ingest (use legacy upcam-client or external writer for now)
- Full motion/zone pipeline parity with SnapShotter
- Published npm package / container image (optional follow-up)

## Upgrade / install

```bash
git checkout v0.1.0
cp .env.example .env   # set TELEGRAM_* and/or NTFY_URL
npm test
npm start
```

See `README.md` and `docs/MIGRATION.md`.
