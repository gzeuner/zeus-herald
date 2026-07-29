# Migration guide: upcam-client / SnapShotter -> zeus-herald

## Goal

zeus-herald replaces the legacy camera pipeline with:

- Node.js Reolink snapshot ingest
- JPEG pixel motion detection with ROI support
- Telegram and/or ntfy mobile delivery
- No WhatsApp Web, no Puppeteer, no Chromium session recovery

## Recommended Migration

1. Install zeus-herald and run `npm install`.
2. Copy `.env.example` to `.env`.
3. Configure Reolink camera credentials in local `.env`.
4. Configure Telegram, ntfy, or both in local `.env`.
5. Test camera ingest with `npm run ingest:once`.
6. Test mobile delivery with `npm run notify:latest`.
7. Run `npm run ingest` and `npm run motion` as two processes.
8. Stop the old Java/WhatsApp pipeline once the new flow is stable.

Do not copy `.env`, WhatsApp session data, or any legacy secret files into git.

## Config Mapping

| Legacy | zeus-herald |
| --- | --- |
| `camera.type=REOLINK` | `CAMERA_TYPE=reolink` |
| `reolink.host` | `REOLINK_HOST` |
| `reolink.httpPort` | `REOLINK_HTTP_PORT` |
| `reolink.username` | `REOLINK_USER` |
| `reolink.password` | `REOLINK_PASSWORD` |
| `reolink.snapshotPath` | `REOLINK_SNAPSHOT_PATH` |
| `reolink.burst.enabled` | `REOLINK_BURST_ENABLED` |
| `image.local.store.rcv` | `MOTION_RECEIVED_DIR` / `INGEST_TARGET_DIR` |
| `image.local.store.snt` | `MOTION_SENT_DIR` |
| `prefilter.resizeWidth` | `MOTION_RESIZE_WIDTH` |
| `prefilter.cropTopPx` | `MOTION_CROP_TOP_PX` |
| `prefilter.failMode=open` | JPEG decode fallback remains fail-open |
| `runtime.cooldownSeconds` equivalent | `MOTION_COOLDOWN_MS` |
| WhatsApp chat | `TELEGRAM_CHAT_ID` or `NTFY_URL` |

## Neutral Reolink Profile

Use placeholders in documentation and replace them only in private `.env`:

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

Quote passwords with special characters:

```env
REOLINK_PASSWORD="your#password"
```

## Motion Differences

The old system had a larger zone model. zeus-herald currently uses a pragmatic pixel pipeline:

1. Decode Reolink JPEG
2. Resize to `MOTION_RESIZE_WIDTH`
3. Crop `MOTION_CROP_TOP_PX`
4. Apply optional polygon ROI mask
5. Compare grayscale pixels between frames
6. Require confirmation frames and cooldown before sending

Starting values:

```env
MOTION_IMAGE_DECODE_ENABLED=true
MOTION_RESIZE_WIDTH=384
MOTION_CROP_TOP_PX=24
MOTION_PIXEL_DIFF_THRESHOLD=17
MOTION_SCORE_THRESHOLD=0.08
MOTION_CONFIRM_COUNT=3
MOTION_COOLDOWN_MS=9000
MOTION_MAX_SENDS=4
```

The legacy ROI polygons are present in `.env.example` as `MOTION_ROI_POLYGONS_JSON`. Treat them as a starting point. Final zone tuning should be done against real Reolink images from the deployment location.

## Mobile Delivery

Telegram and ntfy are peers behind the same notifier hub. Motion detection does not change depending on the selected client.

### Telegram

- Install Telegram on the phone.
- Create a bot with `@BotFather`.
- Start a chat with the bot.
- Put `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in private `.env`.

### ntfy

- Install ntfy on the phone.
- Subscribe to a long private topic.
- Put `NTFY_URL` in private `.env`.
- For authenticated ntfy, use a private/self-hosted server and `NTFY_TOKEN`.

## Image Compression

All notifier uploads use the shared image loader:

```env
NOTIFIER_IMAGE_COMPRESSION_ENABLED=true
NOTIFIER_IMAGE_MAX_WIDTH=1280
NOTIFIER_IMAGE_JPEG_QUALITY=72
```

This keeps Telegram and ntfy behavior aligned and limits mobile data usage.


## Cleanup Mapping

The legacy cleanup settings map to these zeus-herald values:

```env
CLEANUP_ENABLED=true
CLEANUP_INTERVAL_MS=300000
CLEANUP_IMAGES_ENABLED=true
CLEANUP_IMAGES_MAX_AGE_HOURS=36
CLEANUP_LOGS_ENABLED=true
CLEANUP_LOGS_MAX_AGE_HOURS=48
```

This keeps camera images for 36 hours and log files for 2 days by default. Both values are configurable in private `.env`.
## Verification Checklist

- [ ] `.env` exists locally and is not committed.
- [ ] `npm run lint` passes.
- [ ] `npm test` passes.
- [ ] `npm run ingest:once` stores a real JPEG in `images/received/`.
- [ ] `npm run notify:latest` reaches the selected phone client.
- [ ] `npm run ingest` and `npm run motion` run as separate processes.
- [ ] Duplicate workers are rejected by process locks.
- [ ] Quiet frames go to `images/filtered/`.
- [ ] Real motion frames go to `images/sent/` and are notified.

## Retire Legacy

After successful live testing:

- Stop old `upcam-client` processes.
- Stop SnapShotter / WhatsApp automation.
- Do not migrate `.wwebjs_auth`.
- Keep old repositories read-only for rollback until zeus-herald thresholds are stable.

