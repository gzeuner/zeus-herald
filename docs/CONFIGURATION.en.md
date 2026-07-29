# Configuration

This file describes the main configuration areas for Zeus Herald. The concrete local configuration lives in `.env` and must not be committed. Use only placeholders in examples.

## Basic Principle

Zeus Herald reads configuration from environment variables. The NPM scripts use Node.js with `--env-file=.env`, so local installations do not need an additional dotenv dependency.

```bash
cp .env.example .env
```

`.env.example` is the neutral template. `.env` contains real credentials and remains private.

## Camera Ingest

Important variables:

| Variable | Purpose |
| --- | --- |
| `CAMERA_TYPE` | `reolink` or `upcam`; default is `reolink`. |
| `CAMERA_ID` | Logical camera name for filenames and metadata. |
| `INGEST_MODE` | `files_only` writes images; `direct_notify` sends every capture directly. |
| `INGEST_TARGET_DIR` | Target folder for received images, default `images/received`. |
| `INGEST_INTERVAL_MS` | Polling interval for long-running mode. |
| `INGEST_TIMEOUT_MS` | HTTP timeout for camera requests. |
| `INGEST_WRITE_METADATA` | Writes optional `.json` sidecars. |
| `INGEST_ONCE` | Performs exactly one capture. |

## Reolink

Reolink can be configured through a full snapshot URL or through host, port, credentials, and a path template.

```env
CAMERA_TYPE=reolink
REOLINK_HOST=<camera-host-or-ip>
REOLINK_HTTP_PORT=80
REOLINK_USER=<camera-user>
REOLINK_PASSWORD=<camera-password>
REOLINK_CHANNEL=0
REOLINK_SNAPSHOT_PATH=/cgi-bin/api.cgi?cmd=Snap&channel={channel}&rs={timestamp}&user={usernameEncoded}&password={passwordEncoded}
```

Alternative:

```env
REOLINK_SNAPSHOT_URL=<full-snapshot-url>
```

If a password contains special characters such as `#`, quote it in `.env`.

### Reolink Burst Capture

```env
REOLINK_MOTION_STATE_PATH=/cgi-bin/api.cgi?cmd=GetMdState&channel={channel}&rs={timestamp}&user={usernameEncoded}&password={passwordEncoded}
REOLINK_BURST_ENABLED=true
REOLINK_BURST_COUNT=4
REOLINK_BURST_INTERVAL_MS=250
REOLINK_BURST_REQUIRE_SIGNAL=true
```

With `REOLINK_BURST_REQUIRE_SIGNAL=true`, Zeus Herald first polls the camera motion state and stores own snapshots only while the camera reports an alarm. Burst capture then stores several snapshots close together per alarm, which stabilizes later image selection and optional pixel checks.

## UpCam

UpCam support is optional and uses either a full snapshot URL or host plus Basic Auth values.

```env
CAMERA_TYPE=upcam
UPCAM_SNAPSHOT_URL=<full-snapshot-url>
UPCAM_HOST=<camera-host-or-ip>
UPCAM_USER=<camera-user>
UPCAM_PASSWORD=<camera-password>
```

## Motion Detection

Zeus Herald decodes JPEGs, resizes them, optionally crops the top area, applies ROI polygons, and compares grayscale pixels against the previous frame.

| Variable | Purpose |
| --- | --- |
| `MOTION_RECEIVED_DIR` | Input folder for new images. |
| `MOTION_FILTERED_DIR` | Target folder for rejected frames. |
| `MOTION_SENT_DIR` | Target folder for accepted frames. |
| `MOTION_POLL_MS` | Polling interval. |
| `MOTION_NOTIFY` | Sends accepted frames through the notifier hub. |
| `MOTION_IMAGE_DECODE_ENABLED` | Enables JPEG decoding and pixel comparison. |
| `MOTION_RESIZE_WIDTH` | Working width before comparison. |
| `MOTION_CROP_TOP_PX` | Pixels removed from the top after resizing. |
| `MOTION_PIXEL_DIFF_THRESHOLD` | Minimum grayscale difference per pixel. |
| `MOTION_SCORE_THRESHOLD` | Required share of changed pixels. |
| `MOTION_CONFIRM_COUNT` | Confirming frames required before sending. |
| `MOTION_COOLDOWN_MS` | Minimum gap between events. |
| `MOTION_MAX_SENDS` | Maximum sends per event. |

Sensitive starting values for Reolink snapshots:

```env
MOTION_IMAGE_DECODE_ENABLED=true
MOTION_RESIZE_WIDTH=512
MOTION_CROP_TOP_PX=24
MOTION_PIXEL_DIFF_THRESHOLD=12
MOTION_SCORE_THRESHOLD=0.012
MOTION_CONFIRM_COUNT=1
MOTION_COOLDOWN_MS=2000
MOTION_MAX_SENDS=6
```

## ROI Polygons

`MOTION_ROI_POLYGONS_JSON` contains a JSON array of polygons. Coordinates refer to the resized and cropped working image.

```env
MOTION_ROI_POLYGONS_JSON=[[{"x":10,"y":10},{"x":120,"y":10},{"x":120,"y":90},{"x":10,"y":90}]]
```

Use real frames from the deployment location to validate ROIs and tune thresholds. Do not document private image content or exact camera locations.

## Telegram

```env
TELEGRAM_ENABLED=true
TELEGRAM_BOT_TOKEN=<telegram-bot-token>
TELEGRAM_CHAT_ID=<telegram-chat-id>
```

For notifications to multiple people, use a private Telegram group. Invite the bot, send a message in the group, then resolve the group id with:

```bash
npm run telegram:chat-id
```

The helper prints chat ids, not the bot token.

## ntfy

```env
NTFY_ENABLED=true
NTFY_URL=https://ntfy.sh/<long-private-topic>
```

Optional for private or self-hosted ntfy servers:

```env
NTFY_TOKEN=<bearer-token>
```

A public `ntfy.sh` topic without a token is only as private as the topic name. Use a private server or token for stronger access control.

## Image Compression

```env
NOTIFIER_IMAGE_COMPRESSION_ENABLED=true
NOTIFIER_IMAGE_MAX_WIDTH=1920
NOTIFIER_IMAGE_JPEG_QUALITY=88
```

Compression happens centrally before Telegram or ntfy receives the image. If compression fails, the original image is used so notification delivery does not fail solely because of the encoder.

## Cleanup

```env
CLEANUP_ENABLED=true
CLEANUP_INTERVAL_MS=300000
CLEANUP_IMAGES_ENABLED=true
CLEANUP_IMAGES_MAX_AGE_HOURS=36
CLEANUP_IMAGE_DIRS=images/received,images/filtered,images/sent
CLEANUP_IMAGE_EXTENSIONS=.jpg,.jpeg,.png,.webp,.json
CLEANUP_LOGS_ENABLED=true
CLEANUP_LOGS_MAX_AGE_HOURS=48
CLEANUP_LOG_DIRS=logs
CLEANUP_LOG_EXTENSIONS=.log,.ndjson,.txt
```

By default, images and JSON sidecars are removed after 36 hours. Logs are removed after 48 hours.

## Runtime Hardening

| Variable | Purpose |
| --- | --- |
| `QUEUE_MAX_SIZE` | Maximum send queue size. |
| `QUEUE_DROP_POLICY` | Behavior when the queue is full. |
| `HEARTBEAT_MS` | Health file refresh interval. |
| `HEALTH_FILE` | Health file path. |
| `SHUTDOWN_TIMEOUT_MS` | Graceful shutdown timeout. |
| `DECISION_LOG` | Enables optional NDJSON decision logging. |
| `DECISION_LOG_FILE` | Decision log path. |
