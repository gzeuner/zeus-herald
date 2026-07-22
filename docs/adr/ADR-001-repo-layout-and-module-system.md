# ADR-001 – Repository layout, module system, and .gitignore strategy

**Status:** Accepted  
**Date:** 2026-07-22  
**Deciders:** Architect (Coordinator cycle for package 00-foundation)

## Context

zeus-herald is a greenfield successor to upcam-client / SnapShotter. The first package must fix repository layout, Node module style, ignore rules for secrets and local agent state, and a minimal runnable skeleton so later packages (notifiers, runtime) have a stable base.

Constraints from the successor kit and architecture:

- No WhatsApp, Puppeteer, or browser automation
- Telegram Bot + ntfy as primary notifiers
- Multi-agent workflow with ADRs, handoffs, and `.local/` private state
- Node 20+ for the processor / notifier hub; Java may appear later for ingest
- Conventional commits, MIT license, CI-ready structure

## Decision

### 1. Repository layout

```
zeus-herald/
├── src/                    # Node.js application entry & modules
│   ├── index.js            # process entrypoint (placeholder until packages grow)
│   └── notifiers/          # pluggable notifier adapters (package 01+)
├── test/                   # unit / integration tests (Node test runner or later vitest)
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DISCONTINUATION.md
│   ├── NEW-PROJECT-SETUP.md
│   └── adr/                # Architecture Decision Records (ADR-NNN-*.md)
├── agents/                 # multi-agent protocol (not runtime code)
├── packages/               # package specs for agent work units (reference)
├── templates/              # ADR / HANDOFF templates
├── .github/workflows/      # CI skeleton (lint + test placeholders)
├── .local/                 # PRIVATE – roadmap status, handoffs (gitignored)
├── .env.example            # documented env keys only
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

Runtime data directories (`images/`, `state/`, `logs/`) are created at run time and remain gitignored.

### 2. Module system: ES modules (`"type": "module"`)

- `package.json` sets `"type": "module"`.
- Source uses `import` / `export` syntax.
- Node engines: `>=20`.
- Tests use the built-in `node:test` and `node:assert` where possible to avoid early framework lock-in.

Rationale: Node 20 is ESM-first for new projects; aligns with modern Telegram/ntfy HTTP clients; avoids dual CJS/ESM packaging complexity.

### 3. .gitignore strategy

Ignore by category:

| Category | Patterns | Why |
|----------|----------|-----|
| Dependencies | `node_modules/` | installable |
| Secrets | `.env`, `.env.*`, exception `!.env.example` | never commit tokens |
| Agent private state | `.local/` | roadmap status, handoffs, local notes |
| Runtime data | `images/`, `state/`, `logs/`, `*.log` | machine-local |
| Legacy browser stacks | `.wwebjs_auth/`, `.wwebjs_cache/` | prevent accidental reintroduction |
| Build | `dist/`, `build/`, `target/`, `*.class` | Node + future Java |
| OS junk | `.DS_Store`, `Thumbs.db` | noise |

### 4. Configuration

- Env-first configuration; no secrets in git.
- Required keys documented in `.env.example`: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `NTFY_URL`.
- Optional keys may be added in later packages with ADR updates if contracts change.

### 5. CI skeleton

GitHub Actions workflow on `push`/`pull_request` to `main`:

- checkout, setup Node 20, `npm ci` (or `npm install` until lockfile exists), placeholder lint/test scripts.

### 6. Licensing

MIT License at repository root (same spirit as predecessors).

## Consequences

### Positive

- Clear boundaries for agents (one package at a time, ADRs in `docs/adr/`).
- Secrets and agent state cannot leak via normal `git add .`.
- ESM + Node 20 matches long-term notifier and tooling choices.
- CI placeholder establishes the quality gate path early.

### Negative / Trade-offs

- ESM requires `.js` extensions in relative imports (Node native ESM rule).
- No `package-lock.json` until first `npm install` of real dependencies (package 01).
- Java ingest layout is deferred; only Node tree is scaffolded now.

## Alternatives considered

1. **CommonJS** – simpler for copy-paste from some legacy snippets; rejected to avoid a second migration when modern packages assume ESM.
2. **Monorepo workspaces (npm/pnpm)** – premature; single package until notifier hub and ingest boundaries are proven.
3. **TypeScript from day one** – valuable later; rejected for package 00 to keep scaffold minimal and runnable without a build step. May be revisited in a dedicated ADR.
4. **Committing `.local/`** – would expose handoff noise and risk secrets; rejected.
