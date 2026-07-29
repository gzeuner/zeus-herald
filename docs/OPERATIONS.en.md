# Operations

This file describes running Zeus Herald on a target system. It contains no credentials and no private paths.

## Process Model

Zeus Herald uses two separate processes for the camera flow:

```bash
npm run ingest
```

```bash
npm run motion
```

`ingest` fetches camera snapshots and writes them to `images/received/`. For Reolink, it can first poll the camera motion state and store own snapshots as a burst only while the camera reports an alarm. `motion` processes new images, reads optional ingest sidecars, moves them to `images/filtered/` or `images/sent/`, and sends accepted frames through the notifier hub.

## One-Shot Commands

```bash
npm run ingest:once
npm run motion:once
npm run notify:latest
npm run telegram:chat-id
```

- `ingest:once` checks camera capture.
- `motion:once` processes existing input frames once.
- `notify:latest` sends the newest image from the configured folder.
- `telegram:chat-id` shows Telegram chats visible to the bot through `getUpdates`.

## Health File

The notifier hub writes a health file, by default:

```text
state/health.json
```

The path is configurable through `HEALTH_FILE`. The file contains runtime status, queue information, and notifier health. It is runtime data and must not be committed.

## Logs And Decision Sidecars

Zeus Herald uses structured JSON logs on stdout/stderr. Optional decision logging can be enabled:

```env
DECISION_LOG=1
DECISION_LOG_FILE=logs/decisions.ndjson
```

Ingest can write `.json` sidecars next to received images. For Reolink, these can include the camera motion state. Motion reads those sidecars and writes `.decision.json` sidecars next to moved images after processing. They help with tuning and are removed by image cleanup if `.json` is included in `CLEANUP_IMAGE_EXTENSIONS`.

## Image Folders

The default folders images/received, images/filtered, and images/sent are created automatically when ingest or motion first needs them. They are runtime data and must not be committed.

## Process Locks

`ingest` and `motion` use lock files under `.lock/`. This prevents duplicate workers. If a process was killed hard, Zeus Herald removes stale locks when the stored process is no longer running.

## Cleanup

Cleanup starts automatically inside the long-running `ingest` and `motion` processes.

Defaults:

```env
CLEANUP_IMAGES_MAX_AGE_HOURS=36
CLEANUP_LOGS_MAX_AGE_HOURS=48
CLEANUP_INTERVAL_MS=300000
```

This regularly removes old images, JSON sidecars, and logs. Cleanup can be disabled completely if needed:

```env
CLEANUP_ENABLED=false
```

## ZIP Deployment

On the source machine:

```powershell
npm run deploy:zip
```

The ZIP is created under `dist/`. By default it includes the local `.env`, but excludes `node_modules`, `.git`, `images`, `state`, `logs`, `.lock`, `dist`, build folders, and legacy browser sessions.

On the target system:

```powershell
Expand-Archive zeus-herald-deploy-<timestamp>.zip -DestinationPath <target-folder>
cd <target-folder>
npm install
npm run lint
npm test
npm run ingest:once
npm run notify:latest
```

The ZIP is private because it contains `.env`. Do not commit it or store it publicly.

## Long-Running Windows Deployment With NSSM

Example with two NSSM services:

```text
Service: zeus-herald-ingest
Path: <node-install>\npm.cmd
Startup directory: <target-folder>
Arguments: run ingest
```

```text
Service: zeus-herald-motion
Path: <node-install>\npm.cmd
Startup directory: <target-folder>
Arguments: run motion
```

Start, stop, and status are handled through NSSM or Windows Services.

## Update Procedure

1. Stop services.
2. Extract a new ZIP or update the repository.
3. Check `.env` if `.env.example` changed.
4. Run `npm install`, or `npm ci` for lockfile-based deployments.
5. Run `npm run lint` and `npm test`.
6. Test `npm run ingest:once` and `npm run notify:latest`.
7. Start services again.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| No images in `images/received/` | Camera URL, credentials, network, `npm run ingest:once`. |
| Telegram does not send | Bot token, `TELEGRAM_CHAT_ID`, bot was started or messaged in the group. |
| ntfy does not send | `NTFY_URL`, topic, optional `NTFY_TOKEN`, network reachability. |
| Too many notifications | Increase `MOTION_SCORE_THRESHOLD`, `MOTION_CONFIRM_COUNT`, ROI strictness, or cooldown. |
| No notifications on motion | Check camera motion state, `REOLINK_BURST_REQUIRE_SIGNAL`, ROI, `images/filtered/`, and decision sidecars. |
| Worker does not start | Check `.lock/` and ensure no second process is running. |

## Privacy

Camera images can contain personal data. Retention, access to target systems, Telegram groups, ntfy topics, and backup processes should be reviewed against local requirements.
