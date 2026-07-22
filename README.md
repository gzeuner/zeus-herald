# zeus-herald

**Successor to upcam-client + SnapShotter**

Local camera events → reliable multi-channel notifications via **Telegram Bot** and **ntfy** (pluggable notifiers).

> **Status:** v0.1.0 – notifier hub + runtime hardening.  
> No WhatsApp, no Puppeteer, no browser automation.

![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)
![License](https://img.shields.io/badge/License-MIT-green)
![Notifiers](https://img.shields.io/badge/notifiers-Telegram%20%7C%20ntfy-blue)

## Design goals

- Maximum reliability, minimum maintenance
- Official APIs only (Telegram Bot API, ntfy HTTP)
- Pluggable notifiers, bounded queues, health file, graceful shutdown
- Secrets only via environment / `.env` (never committed)
- Multi-agent development protocol under `agents/`

## Pipeline (target)

```
IP Camera (Reolink / UpCam compatible)
        ↓
Ingest (Java legacy or future port) → images/received/ + metadata
        ↓
Event processor (motion / zones – evolving)
        ↓
Notifier Hub (this repo – ready)
   ├── Telegram Bot
   ├── ntfy (ntfy.sh or self-hosted)
   └── future adapters
```

**v0.1.0 ships:** notifier hub, config, runtime supervisor, tests, ban on browser stacks.  
Camera ingest + full motion pipeline remain migration/follow-up work (see `docs/MIGRATION.md`).

## Requirements

- Node.js **20+**
- Telegram bot token + chat id and/or an ntfy topic URL

## Install & first notification

```bash
cd C:\Java\workspace-java\zeus-herald   # or your clone path
cp .env.example .env
# edit .env – at least one channel:

# TELEGRAM_BOT_TOKEN=123456:ABC...
# TELEGRAM_CHAT_ID=123456789
# NTFY_URL=https://ntfy.sh/your-secret-topic

npm test          # optional sanity
npm start         # node --env-file=.env src/index.js
```

### Programmatic send (from another module or REPL)

```js
import { createApp } from './src/app.js';

const app = createApp({ installSignals: false });
await app.start();
const outcome = await app.enqueueNotify(
  'path/to/snapshot.jpg',
  'Motion detected',
  { title: 'Front gate' },
);
console.log(outcome); // { ok, results: [...] }
await app.stop();
```

Overall `ok` is **true if at least one** notifier succeeds. Failures are isolated and logged (JSON lines).

### Health

While running, `state/health.json` is refreshed on each heartbeat (`HEARTBEAT_MS`, default 60s):

- status, uptime, RSS/heap
- queue metrics
- last notifier health snapshot
- send success/fail counters

Graceful stop: **SIGINT** / **SIGTERM** drains the queue (timeout `SHUTDOWN_TIMEOUT_MS`).

## Environment variables

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Bot API token |
| `TELEGRAM_CHAT_ID` | Target chat / group id |
| `TELEGRAM_ENABLED` | Force off with `false` / `0` |
| `NTFY_URL` | Full topic URL |
| `NTFY_TOKEN` | Optional bearer (private ntfy) |
| `NTFY_ENABLED` | Force off with `false` / `0` |
| `NOTIFIER_TIMEOUT_MS` | HTTP timeout (default 30000) |
| `QUEUE_MAX_SIZE` | Bounded queue (default 100) |
| `QUEUE_DROP_POLICY` | `drop_oldest` (default) or `reject` |
| `HEARTBEAT_MS` | Health interval (default 60000) |
| `SHUTDOWN_TIMEOUT_MS` | Drain timeout (default 15000) |
| `HEALTH_FILE` | Default `state/health.json` |
| `DECISION_LOG` | `1` to append NDJSON decisions |
| `DECISION_LOG_FILE` | Default `logs/decisions.ndjson` |

See `.env.example`.

## Project layout

```
src/
  index.js              entry (long-running)
  app.js                wiring: hub + queue + supervisor
  notifiers/            telegram, ntfy, hub
  queue.js              bounded serial queue
  runtimeSupervisor.js  health + metrics
docs/adr/               architecture decisions
packages/               multi-agent work packages
agents/                 roles & protocol
test/                   node:test suite
scripts/check-banned-stack.mjs
```

## Tests & CI

```bash
npm run lint
npm test                # includes WhatsApp/Puppeteer ban check
npm run check:banned
```

GitHub Actions: `.github/workflows/ci.yml` (Node 20, lint + test).

## Architecture docs

| Doc | Content |
|-----|---------|
| `docs/ARCHITECTURE.md` | Principles & components |
| `docs/MIGRATION.md` | From SnapShotter / upcam-client |
| `docs/DISCONTINUATION.md` | Legacy status |
| `docs/adr/ADR-001` … `004` | Layout, notifiers, ban, runtime |
| `agents/ROLES-AND-PROTOCOL.md` | Multi-agent rules |

## Disclaimer

Private open-source tool for technically experienced operators.  
Not affiliated with Telegram, ntfy, UpCam, Reolink, or Meta.  
You are responsible for camera access, privacy, network security, and notification targets.  
Do not use for spam or abusive mass messaging.

## Relationship to legacy projects

| Legacy | Status |
|--------|--------|
| upcam-client | Maintenance only – features → zeus-herald |
| SnapShotter | Maintenance only – features → zeus-herald |

## License

MIT – see `LICENSE`.

## Version

**v0.1.0** – first tagged release of the greenfield notifier runtime.
