<p align="center">
  <img
    src="docs/assets/zeus-herald-hero.png"
    alt="Zeus Herald - local camera motion detection and mobile notifications"
    width="100%">
</p>

<p align="center">
  <a href="README.md">Deutsch</a> ·
  <strong>English</strong>
</p>

<p align="center">
  <a href="https://github.com/gzeuner/zeus-herald/releases"><img alt="GitHub Release" src="https://img.shields.io/github/v/release/gzeuner/zeus-herald?include_prereleases"></a>
  <img alt="Node.js 20+" src="https://img.shields.io/badge/Node.js-20%2B-339933">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-blue"></a>
  <a href="https://github.com/gzeuner/zeus-herald/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/gzeuner/zeus-herald/actions/workflows/ci.yml/badge.svg"></a>
</p>

# Zeus Herald

Zeus Herald is a locally operated Node.js service that fetches camera snapshots, detects image motion, and sends accepted event images to mobile devices through Telegram, ntfy, or both channels.

The project is a lean successor for setups that previously relied on `upcam-client`, SnapShotter, or WhatsApp Web automation. Zeus Herald uses official HTTP/APIs, keeps runtime data local, and handles credentials only through private environment variables.

A tiny-tool.de / TT utility.

## Why Zeus Herald?

- Runs locally without requiring cloud-based camera analysis.
- No browser automation, no WhatsApp Web, no Chromium process.
- Pixel-based JPEG analysis instead of raw byte-stream comparison.
- Telegram Bot API and ntfy as independent notification channels.
- Shared image compression before upload.
- Process locks to prevent duplicate `ingest` or `motion` workers.
- Configurable cleanup for images and logs.
- Optional ZIP deployment without `node_modules`.

## How It Works

```text
Camera
  -> npm run ingest
  -> images/received/
  -> npm run motion
  -> decode JPEG, resize, crop, apply ROI, compare pixels
  -> images/filtered/ or images/sent/
  -> notifier hub
  -> Telegram, ntfy, or both
```

`ingest` and `motion` intentionally run as separate processes. Motion detection makes one decision per frame; all enabled notifiers then receive the same compressed image.

## Features

- Reolink snapshot ingest through the HTTP API, including optional burst capture.
- Optional UpCam snapshot support.
- Local folder contract for received, filtered, and sent images.
- JPEG decoding with resize, crop, ROI polygons, and grayscale pixel comparison.
- Event confirmation, cooldown, and maximum sends per event.
- Telegram photo delivery through the Bot API.
- ntfy image delivery through HTTP PUT.
- One-shot delivery of the newest image.
- Telegram chat-id helper for private chats or private groups.
- Central JPEG compression before Telegram/ntfy upload.
- Health file, structured logs, and decision sidecars.
- Process locks for long-running workers.
- Configurable runtime cleanup.
- ZIP package for deployment to a target machine.

## Requirements

- Node.js 20 or newer.
- A camera with a snapshot endpoint reachable from the machine.
- Optional Telegram for bot notifications.
- Optional ntfy for topic-based notifications.
- Optional NSSM or a comparable service wrapper for long-running Windows deployments.

## Quick Start

```bash
git clone https://github.com/gzeuner/zeus-herald.git
cd zeus-herald
npm install
cp .env.example .env
```

Edit `.env` locally. Use only neutral placeholders in documentation and commits.

```bash
npm run lint
npm test
npm run check:banned
```

First functional checks:

```bash
npm run ingest:once
npm run notify:latest
npm run motion:once
```

## Basic Configuration

The most important `.env` variable groups are:

- Camera ingest: `CAMERA_TYPE`, `INGEST_TARGET_DIR`, `REOLINK_*`, optional `UPCAM_*`.
- Motion detection: `MOTION_*`, especially thresholds, ROI, and folders.
- Notifications: `TELEGRAM_*`, `NTFY_*`.
- Image compression: `NOTIFIER_IMAGE_*`.
- Cleanup: `CLEANUP_*`.
- Runtime: queue, timeout, health, and decision-log values.

Details are documented in [docs/CONFIGURATION.en.md](docs/CONFIGURATION.en.md). The full neutral template is [.env.example](.env.example).

## Operations

Run the full stack as two processes:

```bash
npm run ingest
```

```bash
npm run motion
```

Useful one-shot commands:

```bash
npm run ingest:once
npm run motion:once
npm run notify:latest
npm run telegram:chat-id
npm run deploy:zip
```

Details about the health file, decision sidecars, process locks, cleanup, ZIP deployment, NSSM, and updates are documented in [docs/OPERATIONS.en.md](docs/OPERATIONS.en.md).

## Security

- Never commit or publish `.env`.
- Do not document bot tokens, chat ids, ntfy topics, passwords, or real camera addresses.
- A topic on public `ntfy.sh` without additional authentication is effectively a shared secret. For stronger access control, use a private or self-hosted ntfy server with a token.
- Private Telegram groups can be used for notifications to multiple people. The target audience is controlled through `TELEGRAM_CHAT_ID`.
- ZIP deployments include the local `.env` by default; treat those ZIP files as private and do not place them in cloud or public storage.
- Runtime data such as `images/`, `logs/`, `state/`, `.lock/`, and `dist/` does not belong in the repository.

## Project Layout

```text
src/                         application code
src/ingest/                  camera snapshot ingest
src/motion/                  motion detection and routing
src/notifiers/               Telegram, ntfy, and shared notifier code
scripts/                     maintenance and deployment scripts
test/                        Node.js tests
docs/                        project, configuration, and operations documentation
docs/assets/                 branding and README assets
.github/workflows/ci.yml     GitHub Actions CI
```

## Development And Quality Checks

```bash
npm run lint
npm test
npm run check:banned
git diff --check
```

Tests use the Node.js test runner. The banned-stack check prevents reintroducing WhatsApp Web, Puppeteer, or Playwright runtime dependencies.

## Migration

Guidance for users of previous `upcam-client` or SnapShotter setups is available in [docs/MIGRATION.md](docs/MIGRATION.md).

## License

Zeus Herald is released under the [MIT License](LICENSE).
