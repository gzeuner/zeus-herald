# Migration guide: upcam-client / SnapShotter → zeus-herald

## Why migrate

| Legacy pain | zeus-herald approach |
|-------------|----------------------|
| whatsapp-web.js + Puppeteer / Chromium | Telegram Bot API + ntfy HTTP only |
| Session locks, QR pairing, browser recovery | Stateless HTTP notifiers |
| High idle/memory cost | No headless browser; bounded queues |
| Two-repo complexity for messaging | Single Node package for notifications |

Active feature work on upcam-client and SnapShotter is **discontinued**. See `docs/DISCONTINUATION.md`.

## What v0.1.0 covers

**Ready**

- Pluggable notifiers (Telegram + ntfy)
- Env-first config, secret redaction in logs
- Bounded send queue, health file, heartbeat, graceful shutdown
- Automated ban on WhatsApp/Puppeteer dependencies

**Not yet ported (use legacy ingest temporarily or wait)**

- Java camera pull loop (upcam-client)
- Full motion / zone / event state machine (SnapShotter)
- Sample archive taxonomy and decision parity with legacy scores

Recommended interim setup: keep **upcam-client** (or any process) writing JPEGs to a folder; call zeus-herald’s `enqueueNotify(path, caption)` from a small watcher script, or wait for a future ingest package.

## Side-by-side

| Concern | SnapShotter | zeus-herald |
|---------|-------------|-------------|
| Notify channel | WhatsApp Web | Telegram + ntfy |
| Auth | QR / LocalAuth / `.wwebjs_auth` | Bot token + chat id; ntfy URL |
| Config | `config.js` large tree | `.env` / `process.env` |
| Health | RuntimeSupervisor + WA status | `state/health.json` |
| Shutdown | Browser kill + locks | SIGINT/SIGTERM queue drain |

## Step-by-step

### 1. Create Telegram bot (if using Telegram)

1. Talk to [@BotFather](https://t.me/BotFather) → create bot → copy token.
2. Send a message to the bot (or add it to a group).
3. Resolve `chat_id` (e.g. `https://api.telegram.org/bot<token>/getUpdates`).
4. Put values in `.env` as `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID`.

### 2. Create ntfy topic (if using ntfy)

1. Choose a hard-to-guess topic name on [ntfy.sh](https://ntfy.sh) or your server.
2. Set `NTFY_URL=https://ntfy.sh/<topic>` (or self-hosted URL).
3. Optional: `NTFY_TOKEN` for authenticated servers.
4. Subscribe with the ntfy app or web UI.

### 3. Install zeus-herald

```bash
git clone <your-zeus-herald-url>
cd zeus-herald
git checkout v0.1.0   # or main
cp .env.example .env
# fill credentials
npm test
npm start
```

### 4. Smoke-send an image

From a one-off script (with env loaded):

```bash
node --env-file=.env -e "
import { createApp } from './src/app.js';
const app = createApp({ installSignals: false });
await app.start();
console.log(await app.enqueueNotify('path/to.jpg', 'migration test'));
await app.stop();
"
```

### 5. Retire WhatsApp path

1. Stop SnapShotter processes.
2. Do **not** copy `.wwebjs_auth` into zeus-herald (ignored and banned).
3. Remove WhatsApp-related secrets from shared env files if unused.
4. Keep legacy repos for archive; they point here via README notice.

### 6. Optional: run both during transition

- upcam-client continues writing `images/received/`.
- SnapShotter WhatsApp disabled / stopped.
- zeus-herald sends on accepted frames once your bridge/watcher calls `enqueueNotify`.

## Configuration mapping (approximate)

| SnapShotter / old idea | zeus-herald |
|------------------------|-------------|
| WhatsApp target | `TELEGRAM_CHAT_ID` or `NTFY_URL` |
| Send timeout | `NOTIFIER_TIMEOUT_MS` |
| Back-pressure | `QUEUE_MAX_SIZE`, `QUEUE_DROP_POLICY` |
| Health / observability | `HEALTH_FILE`, `HEARTBEAT_MS`, `DECISION_LOG` |

## Verification checklist

- [ ] `npm test` green
- [ ] `npm run check:banned` OK
- [ ] Test image arrives on Telegram and/or ntfy
- [ ] `state/health.json` updates while `npm start` runs
- [ ] SIGINT stops cleanly without orphan Chromium (there is none)

## Support boundary

zeus-herald will not reintroduce WhatsApp Web or Puppeteer.  
If you need that stack, remain on the frozen legacy code at your own risk.
