# zeus-herald

**Successor to upcam-client + SnapShotter**

Local camera events → motion filter → reliable multi-channel notifications via **Telegram Bot** and **ntfy**.

> **Status:** **v0.2.0-alpha** – ingest + motion + notifier hub.  
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

## Pipeline

```
IP Camera (Reolink / UpCam)
        ↓
[ npm run ingest ]  HTTP snapshot
        ↓
images/received/  (+ optional .json metadata)
        ↓
[ npm run motion ]  Decision { send, reason, metrics }
        ├── send:false → images/filtered/
        └── send:true  → Notifier Hub → images/sent/
                              ├── Telegram Bot
                              └── ntfy
```

| Mode | How |
|------|-----|
| **Full stack** | `ingest` writes `received/` · `motion` decides · hub notifies |
| **Ingest only** | `INGEST_MODE=files_only` (default) or `direct_notify` skips motion |
| **Motion only** | Drop JPEGs into `images/received/` (or any folder via env) |
| **Notify only** | `createApp().enqueueNotify(path, caption)` |

## Requirements

- Node.js **20+**
- For live notify: Telegram and/or ntfy credentials
- For live ingest: Reolink snapshot URL/host (or UpCam)

## Install

```bash
git clone https://github.com/gzeuner/zeus-herald.git
cd zeus-herald
git checkout v0.2.0-alpha   # or main
cp .env.example .env
# edit .env
npm test
```

## Quick paths

### A) Notify-only smoke

```bash
# .env: TELEGRAM_* and/or NTFY_URL
npm start
# other terminal / script:
node --env-file=.env --input-type=module -e "
import { createApp } from './src/app.js';
const app = createApp({ installSignals: false });
await app.start();
console.log(await app.enqueueNotify('path/to.jpg', 'hello'));
await app.stop();
"
```

### B) Full stack (two processes)

```bash
# .env: REOLINK_* or REOLINK_SNAPSHOT_URL, TELEGRAM_* and/or NTFY_URL
# optional tune: MOTION_SCORE_THRESHOLD, MOTION_COOLDOWN_MS, …

# terminal 1 – capture
npm run ingest

# terminal 2 – decide + notify
npm run motion
```

Single-shot helpers:

```bash
INGEST_ONCE=1 npm run ingest
MOTION_ONCE=1 npm run motion
```

### C) Motion on fixtures (no camera)

```bash
# copy two different JPEGs into images/received/
# first establishes baseline; second with real change may send
MOTION_ONCE=1 npm run motion
```

## Environment variables (summary)

### Notifiers

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Telegram Bot API |
| `TELEGRAM_ENABLED` | Force off with `false` / `0` |
| `NTFY_URL` / `NTFY_TOKEN` | ntfy topic (+ optional auth) |
| `NTFY_ENABLED` | Force off |
| `NOTIFIER_TIMEOUT_MS` | HTTP timeout (default 30000) |

### Runtime

| Variable | Purpose |
|----------|---------|
| `QUEUE_MAX_SIZE` / `QUEUE_DROP_POLICY` | Send queue back-pressure |
| `HEARTBEAT_MS` / `HEALTH_FILE` | Health file refresh |
| `SHUTDOWN_TIMEOUT_MS` | Graceful drain |
| `DECISION_LOG` / `DECISION_LOG_FILE` | Optional NDJSON |

### Ingest (package 05)

| Variable | Purpose |
|----------|---------|
| `CAMERA_TYPE` | `reolink` (default) or `upcam` |
| `CAMERA_ID` | Logical name in metadata |
| `INGEST_MODE` | `files_only` \| `direct_notify` |
| `INGEST_TARGET_DIR` | Default `images/received` |
| `INGEST_INTERVAL_MS` / `INGEST_TIMEOUT_MS` / `INGEST_ONCE` | Poll / HTTP / single shot |
| `INGEST_WRITE_METADATA` | Sidecar `.json` (default true) |
| `REOLINK_SNAPSHOT_URL` or `REOLINK_HOST` + `USER` + `PASSWORD` | Snapshot source |
| `UPCAM_SNAPSHOT_URL` or `UPCAM_HOST` + auth | Optional UpCam |

### Motion (package 06)

| Variable | Purpose |
|----------|---------|
| `MOTION_RECEIVED_DIR` / `FILTERED_DIR` / `SENT_DIR` | Folder contract |
| `MOTION_POLL_MS` / `MOTION_ONCE` | Watcher |
| `MOTION_NOTIFY` | Call hub on send (default true) |
| `MOTION_SCORE_THRESHOLD` / `MOTION_PIXEL_DIFF_THRESHOLD` | Delta sensitivity |
| `MOTION_BRIGHTNESS_MIN` / `MAX` | Reject dark/bright frames |
| `MOTION_CONFIRM_COUNT` / `MOTION_COOLDOWN_MS` / `MOTION_MAX_SENDS` | Spam control |
| `MOTION_ROI_START` / `END` / `MOTION_ZONES_JSON` | Coarse ROI / zones |

Full commented list: `.env.example`.

## Health

`state/health.json` (when hub/`npm start` runs): status, RSS, queue, notifier health, send counters.  
Motion writes `.decision.json` next to archived frames under `filtered/` and `sent/`.

Graceful stop: **SIGINT** / **SIGTERM**.

## Project layout

```
src/
  index.js, app.js          hub + runtime
  notifiers/                telegram, ntfy
  ingest/                   camera HTTP → received/
  motion/                   decision + folder routing
  ingest-cli.js, motion-cli.js
docs/adr/                   ADR-001 … 006
packages/                   agent package specs 00–07
test/                       unit + e2e-pipeline
```

## Tests & CI

```bash
npm run lint
npm test                # ban check + unit + e2e mock pipeline
npm run check:banned
```

GitHub Actions: `.github/workflows/ci.yml`.

## Architecture docs

| Doc | Content |
|-----|---------|
| `docs/ARCHITECTURE.md` | Principles |
| `docs/MIGRATION.md` | From SnapShotter / upcam-client |
| `docs/DISCONTINUATION.md` | Legacy status |
| `docs/adr/ADR-001` … `006` | Layout, notifiers, ban, runtime, ingest, motion |
| `docs/RELEASE-NOTES-v0.2.0-alpha.md` | This alpha release |
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

**v0.2.0-alpha** – ingest + motion + notifier hub (alpha).  
Stable notifier-only baseline: **v0.1.0**.
