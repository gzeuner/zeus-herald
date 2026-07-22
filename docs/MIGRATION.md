# Migration guide: upcam-client / SnapShotter → zeus-herald

## Why migrate

| Legacy pain | zeus-herald approach |
|-------------|----------------------|
| whatsapp-web.js + Puppeteer / Chromium | Telegram Bot API + ntfy HTTP only |
| Session locks, QR pairing, browser recovery | Stateless HTTP notifiers |
| High idle/memory cost | No headless browser; bounded queues |
| Two-repo complexity for messaging | Single Node package for capture → decide → notify |

Active feature work on upcam-client and SnapShotter is **discontinued**. See `docs/DISCONTINUATION.md`.

## What each version covers

### v0.1.0 (stable tag)

- Pluggable notifiers (Telegram + ntfy)
- Env-first config, secret redaction
- Bounded send queue, health file, graceful shutdown
- Ban on WhatsApp/Puppeteer dependencies

### v0.2.0-alpha (current stack)

| Piece | Legacy | zeus-herald |
|-------|--------|-------------|
| Capture | upcam-client (Java) | `npm run ingest` (Node HTTP snapshot) |
| Motion / events | SnapShotter | `npm run motion` (simplified confirm/cooldown/delta) |
| Notify | WhatsApp Web | Telegram + ntfy hub |
| Folders | received / filtered / sent (similar) | `images/received` → `filtered` \| `sent` |

**Not full SnapShotter parity:** motion uses a coarse byte-sample delta (no Sharp/ML). Tune thresholds or extend metrics later.

## Migration strategies

### Strategy A – Full zeus-herald stack (recommended for greenfield)

1. Install zeus-herald `@ v0.2.0-alpha` (or `main`).
2. Configure `.env`: camera (`REOLINK_*`) + notifiers (`TELEGRAM_*` / `NTFY_URL`).
3. Run **two processes**: `npm run ingest` and `npm run motion`.
4. Stop SnapShotter WhatsApp and optional Java ingest when stable.

### Strategy B – Keep Java ingest, replace SnapShotter notify

1. Point upcam-client output at `images/received/` (or set `MOTION_RECEIVED_DIR`).
2. Run only `npm run motion` (+ notifier env).
3. Retire WhatsApp / Puppeteer path.

### Strategy C – Notify bridge only (v0.1 style)

1. External process decides “send”.
2. Call `createApp().enqueueNotify(path, caption)`.
3. No motion package required.

### Strategy D – Ingest direct notify (skip motion)

1. `INGEST_MODE=direct_notify` + notifier env.
2. Every successful snapshot is enqueued (no cooldown/delta). Use only for tests or low-rate cameras.

## Side-by-side

| Concern | SnapShotter / upcam-client | zeus-herald v0.2-alpha |
|---------|----------------------------|-------------------------|
| Notify channel | WhatsApp Web | Telegram + ntfy |
| Auth | QR / LocalAuth / `.wwebjs_auth` | Bot token + chat id; ntfy URL |
| Config | large `config.js` / Java props | `.env` / `process.env` |
| Health | RuntimeSupervisor + WA status | `state/health.json` + `.decision.json` |
| Shutdown | Browser kill + locks | SIGINT/SIGTERM queue drain |
| Motion | Full detector + zones model | Simplified delta + confirm/cooldown |

## Step-by-step (full stack)

### 1. Notifier credentials

**Telegram:** BotFather → token; resolve `chat_id` via `getUpdates`.  
**ntfy:** secret topic URL; optional `NTFY_TOKEN`.

### 2. Camera

Prefer `REOLINK_SNAPSHOT_URL` if you already know the Snap CGI URL, else:

```env
CAMERA_TYPE=reolink
REOLINK_HOST=192.168.x.x
REOLINK_USER=admin
REOLINK_PASSWORD=...
REOLINK_CHANNEL=0
```

### 3. Install

```bash
git clone https://github.com/gzeuner/zeus-herald.git
cd zeus-herald
git checkout v0.2.0-alpha
cp .env.example .env
# fill credentials
npm test
```

### 4. Run

```bash
npm run ingest    # → images/received/
npm run motion    # → filtered/ or sent/ + notify
```

### 5. Retire legacy

1. Stop SnapShotter processes.
2. Do **not** copy `.wwebjs_auth` into zeus-herald.
3. Optionally keep upcam-client as producer only (Strategy B) until Node ingest is trusted.

## Config mapping (approximate)

| Legacy idea | zeus-herald |
|-------------|-------------|
| WhatsApp target | `TELEGRAM_CHAT_ID` / `NTFY_URL` |
| Snapshot poll | `INGEST_INTERVAL_MS` + Reolink URL |
| Motion threshold | `MOTION_SCORE_THRESHOLD`, `MOTION_PIXEL_DIFF_THRESHOLD` |
| Cooldown | `MOTION_COOLDOWN_MS` |
| Max alerts | `MOTION_MAX_SENDS` |
| Confirm frames | `MOTION_CONFIRM_COUNT` |
| Health | `HEALTH_FILE`, decision sidecars |

## Verification checklist

- [ ] `npm test` green (includes e2e mock pipeline)
- [ ] `npm run check:banned` OK
- [ ] Test image arrives on Telegram and/or ntfy
- [ ] Ingest writes under `images/received/` with optional `.json`
- [ ] Motion routes baseline/static to `filtered/`, change to `sent/`
- [ ] SIGINT stops cleanly; no Chromium process

## Support boundary

zeus-herald will not reintroduce WhatsApp Web or Puppeteer.  
If you need that stack, remain on frozen legacy code at your own risk.
