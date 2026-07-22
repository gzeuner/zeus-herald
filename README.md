# zeus-herald

**Successor project to upcam-client + SnapShotter**

Local camera snapshot ingest → intelligent motion/event filtering → reliable multi-channel notifications  
(Telegram Bot + ntfy / Gotify and pluggable notifiers).

> Status: **Greenfield successor** – the previous projects are officially discontinued for active feature development.
> This repository (or branch) is the single source of truth going forward.

## Design Goals

- Maximum reliability, minimum maintenance
- No browser automation, no reverse-engineered messaging clients
- Fully autonomous multi-agent development (Architect / Implementers / Reviewers / Testers)
- Clean separation of concerns, pluggable notifiers, observable runtime
- Best-practice engineering (ADRs, conventional commits, CI-ready, tests first where sensible)

## High-level Pipeline

```
IP Camera (Reolink / UpCam compatible)
        ↓
Ingest Service (Java or future rewrite)
        ↓  images/received/ + metadata
Event Processor (Node – motion, zones, events)
        ↓
Notifier Hub (pluggable)
   ├── Telegram Bot
   ├── ntfy / Gotify
   └── future adapters
```

## Project Name Rationale

**zeus-herald**  
- Zeus = existing author namespace / personal brand in the original repos  
- Herald = the messenger of the gods → perfect metaphor for event notifications  
- Not a protected trademark in the software/camera/notification space (as of research date)

## Relationship to legacy projects

| Legacy | Status |
|--------|--------|
| gzeuner/upcam-client | Discontinued for new features – security/maintenance only |
| gzeuner/SnapShotter | Discontinued for new features – security/maintenance only |

See `docs/DISCONTINUATION.md` and the notice that will be added to the legacy READMEs.

## Multi-Agent Development Model

See `agents/ROLES-AND-PROTOCOL.md`.  
Executing runtime: **Grok CLI** (and compatible agents).  
Roadmap & local working state live under `.local/` (never committed).

## Quick start (once implemented)

```bash
# after scaffolding
cp .env.example .env          # set TELEGRAM_* and NTFY_*
npm ci
node src/index.js
```

## License

MIT (same spirit as the predecessors)
