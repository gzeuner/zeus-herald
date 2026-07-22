# ADR-003 – Ban WhatsApp / Puppeteer / browser automation

**Status:** Accepted  
**Date:** 2026-07-22  
**Deciders:** Architect (package 02-cleanup-whatsapp)

## Context

Package 02 in the roadmap was written assuming a migration from SnapShotter that still contained `whatsapp-web.js` and Puppeteer. **zeus-herald is a greenfield repository**: those modules were never copied into `src/`. The package goal remains mandatory: the product must never reintroduce that stack.

Legacy pain (documented in `docs/DISCONTINUATION.md`):

- Continuous breakage of unofficial WhatsApp clients
- Chromium process lifecycle, memory leaks, session locks
- High operational cost for a personal camera notifier

## Decision

### 1. Hard ban (runtime)

The following must never appear as runtime dependencies or application imports under `src/`:

- `whatsapp-web.js` and forks
- `puppeteer`, `puppeteer-core`, `playwright`, similar headless browsers
- Any package that launches Chromium/Firefox/WebKit for messaging
- Session dirs `.wwebjs_auth/`, `.wwebjs_cache/` (remain gitignored as belt-and-suspenders)

### 2. Allowed mentions

References in documentation, ADRs, package specs, and discontinuation notices are allowed when they explain the ban or history.

### 3. Enforcement

- Automated check script: `scripts/check-banned-stack.mjs`
- Wired into `npm test` (fails CI if ban violated)
- Scans: `package.json` dependency fields + all files under `src/` and `test/`

### 4. Cleanup inventory for this repo

| Legacy artifact | Status in zeus-herald |
|-----------------|------------------------|
| `src/whatsappSupport.js` | Never present |
| WhatsApp symbols in entrypoint | Never present |
| npm deps whatsapp/puppeteer | Never present |
| Browser kill on shutdown | N/A – no browser |

No deletion of runtime code was required; the deliverable is **policy + automated guardrails**.

## Consequences

### Positive

- Ban cannot silently regress via copy-paste from legacy
- CI and local `npm test` enforce the product principle
- Clear story for package 02 acceptance without fake file deletions

### Negative / Trade-offs

- Playwright cannot be used for e2e UI tests in this repo without ADR amendment (acceptable; product has no browser UI)

## Alternatives considered

1. **Only document the ban** – too weak; agents/humans may re-add deps.
2. **npm overrides / package denylist plugins** – heavier than needed for v1.
3. **Copy SnapShotter then delete WhatsApp** – rejected; greenfield is cleaner.
