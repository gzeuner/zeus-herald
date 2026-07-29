# zeus-herald

Local camera snapshots -> pixel motion filter -> mobile notifications via Telegram and/or ntfy.

zeus-herald replaces the old `upcam-client` / SnapShotter workflow without WhatsApp Web, Puppeteer, Chromium, or browser session handling.

## Security

- Keep `.env` private. Do not commit or push it.
- Use `.env.example` only as the neutral template.
- `images/`, `state/`, `logs/`, `.lock/`, and `.env*` are ignored by git.
- Do not put camera passwords, bot tokens, chat ids, private ntfy topics, or real LAN camera addresses into documentation or commits.

## Pipeline

```text
Reolink camera
  -> npm run ingest
  -> images/received/
  -> npm run motion
  -> pixel decode, resize, crop, ROI mask, frame delta
  -> images/filtered/ or images/sent/
  -> notifier hub
  -> Telegram, ntfy, or both
```

Motion detection runs once. Telegram and ntfy use the same accepted frames and the same compressed upload bytes; only the communication channel differs.

## Requirements

- Node.js 20+
- A Reolink camera reachable from this machine
- Optional mobile clients:
  - Telegram app for Telegram Bot notifications
  - ntfy app for ntfy notifications

## Install

```bash
git clone https://github.com/gzeuner/zeus-herald.git
cd zeus-herald
npm install
cp .env.example .env
```

Edit `.env` locally. Never commit it.

Run the verification suite:

```bash
npm run lint
npm test
```

## Camera Setup

Use a neutral Reolink profile like this in local `.env` and replace placeholders only on your machine:

```env
CAMERA_TYPE=reolink
CAMERA_ID=front
INGEST_MODE=files_only
INGEST_TARGET_DIR=images/received
INGEST_INTERVAL_MS=3000
INGEST_TIMEOUT_MS=15000

REOLINK_HOST=<camera-host-or-ip>
REOLINK_HTTP_PORT=80
REOLINK_USER=<camera-user>
REOLINK_PASSWORD=<camera-password>
REOLINK_CHANNEL=0
REOLINK_SNAPSHOT_PATH=/cgi-bin/api.cgi?cmd=Snap&channel={channel}&rs={timestamp}&user={usernameEncoded}&password={passwordEncoded}

REOLINK_BURST_ENABLED=true
REOLINK_BURST_COUNT=2
REOLINK_BURST_INTERVAL_MS=350
REOLINK_BURST_REQUIRE_SIGNAL=false
```

If your password contains `#`, wrap it in quotes in `.env`:

```env
REOLINK_PASSWORD="your#password"
```

Quick camera test:

```bash
npm run ingest:once
```

Expected result: a JPEG appears under `images/received/`. Invalid Reolink JSON/API responses are rejected and not stored as JPEGs.

## Motion Setup

The Reolink path decodes JPEGs, resizes them, crops the camera overlay area, applies optional ROI polygons, and compares grayscale pixels. This avoids false positives from JPEG byte-stream changes.

Recommended starting values:

```env
MOTION_RECEIVED_DIR=images/received
MOTION_FILTERED_DIR=images/filtered
MOTION_SENT_DIR=images/sent
MOTION_NOTIFY=true

MOTION_IMAGE_DECODE_ENABLED=true
MOTION_RESIZE_WIDTH=384
MOTION_CROP_TOP_PX=24
MOTION_PIXEL_DIFF_THRESHOLD=17
MOTION_SCORE_THRESHOLD=0.08
MOTION_CONFIRM_COUNT=3
MOTION_COOLDOWN_MS=9000
MOTION_MAX_SENDS=4
```

The ROI polygons from the old camera profile are available in `.env.example` as `MOTION_ROI_POLYGONS_JSON`. They should be validated against real Reolink frames before further tuning.

## Mobile Clients

### Telegram

Install and authenticate:

1. Install Telegram on the phone.
2. Open `@BotFather` in Telegram.
3. Create a bot with `/newbot`.
4. Store the bot token only in local `.env` as `TELEGRAM_BOT_TOKEN`.
5. Open a chat with the new bot and send `/start`.
6. Resolve the chat id with `npm run telegram:chat-id`.
7. Store the chat id only in local `.env` as `TELEGRAM_CHAT_ID`.

Local `.env`:

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_CHAT_ID=<telegram-chat-id>
```

### ntfy

Install and authenticate:

1. Install the ntfy app on the phone.
2. Choose a long, private topic name.
3. Subscribe to that topic in the phone app.
4. Store the topic URL only in local `.env` as `NTFY_URL`.

Local `.env` for public `ntfy.sh`:

```env
NTFY_ENABLED=true
NTFY_URL=https://ntfy.sh/<long-private-topic>
```

Public `ntfy.sh` topics do not require account authentication. The topic name is the shared secret. For real authentication, use a private/self-hosted ntfy server and set:

```env
NTFY_TOKEN=<bearer-token>
```

### Shared Family Chat

For you and your wife, use a private Telegram group:

1. Create a private Telegram group.
2. Invite your wife.
3. Invite the bot.
4. Send a message in the group, for example `/start`.
5. Run `npm run telegram:chat-id`.
6. Copy the negative group id into local `.env` as `TELEGRAM_CHAT_ID`.
7. Optional hardening: in `@BotFather`, run `/setjoingroups` and disable future group joins after the bot is already in this group.

The helper prints chat ids only. It does not print the bot token.

### Enable One Or Both

- Telegram only: configure `TELEGRAM_*`, leave `NTFY_ENABLED=false` or `NTFY_URL` empty.
- ntfy only: configure `NTFY_URL`, leave `TELEGRAM_ENABLED=false` or Telegram values empty.
- Both: configure both. Every accepted motion event is sent to both.

## Image Compression

Images are compressed centrally before upload to either notifier.

```env
NOTIFIER_IMAGE_COMPRESSION_ENABLED=true
NOTIFIER_IMAGE_MAX_WIDTH=1280
NOTIFIER_IMAGE_JPEG_QUALITY=72
```

If compression fails, the notifier falls back to the original image so notification delivery is not blocked by the encoder.

## Run

Use two processes for the full stack:

```bash
npm run ingest
```

```bash
npm run motion
```

Single-shot helpers:

```bash
npm run ingest:once
npm run motion:once
npm run notify:latest
```

Process locks prevent duplicate ingest or motion workers from running at the same time. Stop with `Ctrl+C`.

## Notify Smoke Test

Send the newest image from `NOTIFY_LATEST_DIR`:

```bash
npm run notify:latest
```

Send an explicit image:

```bash
npm run notify -- --image images/received/example.jpg --caption "camera test"
```

Optional local `.env` values:

```env
NOTIFY_LATEST_DIR=images/received
NOTIFY_IMAGE_PATH=
NOTIFY_CAPTION=zeus-herald camera image
```



## Cleanup

Runtime cleanup runs inside the long-running `ingest` and `motion` workers.

Defaults:

```env
CLEANUP_ENABLED=true
CLEANUP_INTERVAL_MS=300000
CLEANUP_IMAGES_ENABLED=true
CLEANUP_IMAGES_MAX_AGE_HOURS=36
CLEANUP_IMAGE_DIRS=images/received,images/filtered,images/sent
CLEANUP_LOGS_ENABLED=true
CLEANUP_LOGS_MAX_AGE_HOURS=48
CLEANUP_LOG_DIRS=logs
```

Image cleanup removes old image files and their `.json` metadata sidecars from the configured image folders. Log cleanup removes old `.log`, `.ndjson`, and `.txt` files from the configured log folders.

Set `CLEANUP_ENABLED=false` to disable all cleanup, or disable one side with `CLEANUP_IMAGES_ENABLED=false` / `CLEANUP_LOGS_ENABLED=false`.
## ZIP Deployment

Build a deployable ZIP on the source machine:

```powershell
npm run deploy:zip
```

The ZIP is written to `dist/` and intentionally includes local `.env` unless `-NoEnv` is used directly with the PowerShell script. It excludes `node_modules`, `.git`, `images`, `state`, `logs`, `.lock`, build folders, and legacy browser session folders.

Copy the ZIP to the target system, extract it, then run:

```powershell
cd <target-folder>
npm install
npm run lint
npm test
npm run ingest:once
npm run notify:latest
```

After verification, configure NSSM with two services:

```text
Path: <node-install>\npm.cmd
Startup directory: <target-folder>
Arguments: run ingest
```

```text
Path: <node-install>\npm.cmd
Startup directory: <target-folder>
Arguments: run motion
```

Keep the ZIP private because it contains `.env`. Do not commit the ZIP, and do not copy it to public storage.
## Operations

- Health file: `state/health.json`
- Decision log sidecars: `.decision.json` next to moved frames
- App logs are optional through configured log files
- Runtime output and camera images are ignored by git

## Project Layout

```text
src/
  app.js, index.js          notifier hub and exports
  ingest/                   camera HTTP capture
  motion/                   pixel metrics, decision, folder routing
  notifiers/                Telegram, ntfy, shared compression
  ingest-cli.js             ingest worker
  motion-cli.js             motion worker
  notify-cli.js             one-shot mobile send
docs/
  MIGRATION.md              legacy migration notes
test/
  *.test.js                 unit and integration tests
```

## Commands

```bash
npm run lint
npm test
npm run check:banned
npm run ingest:once
npm run motion:once
npm run notify:latest
```

## Legacy Status

| Legacy project | zeus-herald replacement |
| --- | --- |
| upcam-client | `npm run ingest` |
| SnapShotter motion routing | `npm run motion` |
| WhatsApp delivery | Telegram Bot API and/or ntfy |

WhatsApp Web and Puppeteer are intentionally not part of zeus-herald.



