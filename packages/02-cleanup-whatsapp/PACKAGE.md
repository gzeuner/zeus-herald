# Package 02 – Cleanup WhatsApp

## Goal
Completely remove whatsapp-web.js, Puppeteer, all recovery/browser/session code and the old support module.

> **zeus-herald note:** This is a greenfield successor. WhatsApp/Puppeteer were never
> imported into `src/`. Package 02 delivers a hard ban + automated guardrails
> (ADR-003) so the stack cannot reappear.

## Tasks

1. Inventory: confirm no `src/whatsappSupport.js` / SnapShotter WhatsApp symbols (N/A if greenfield).
2. Ensure `package.json` has zero banned deps; no install of whatsapp/puppeteer.
3. Keep `.wwebjs_*` in `.gitignore`; no runtime session code.
4. Architect: ADR-003 banned browser stack.
5. Implementer: `scripts/check-banned-stack.mjs` + test wiring.
6. Reviewer: `rg` zero matches under `src/` and `test/` for banned terms; deps clean.
7. Tester: `npm test` includes banned-stack check; dry-run entrypoint with Telegram/ntfy only.

## Acceptance

- [ ] No Chromium process is ever launched
- [ ] `src/` and `test/` have zero banned runtime references
- [ ] Automated ban check in CI/`npm test`
- [ ] Reviewer + Tester sign-off
