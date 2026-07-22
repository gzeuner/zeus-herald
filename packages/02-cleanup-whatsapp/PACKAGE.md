# Package 02 – Cleanup WhatsApp

## Goal
Completely remove whatsapp-web.js, Puppeteer, all recovery/browser/session code and the old support module.

## Tasks

1. Delete `src/whatsappSupport.js`.
2. Strip `SnapShotter.js` (or successor entry point) of every WhatsApp symbol.
3. Remove dependencies from package.json; run `npm install`.
4. Delete any remaining `.wwebjs_*` references and documentation.
5. Update graceful shutdown (no browser kill needed).
6. Reviewer: confirm zero remaining references (`rg -i whatsapp|puppeteer|wwebjs|LocalAuth`).
7. Tester: dry-run + manual send still works with Telegram/ntfy only.

## Acceptance

- [ ] No Chromium process is ever launched
- [ ] `rg` shows zero matches for the banned terms (except historical docs if kept)
- [ ] Memory under idle is dramatically lower
- [ ] Reviewer + Tester sign-off
