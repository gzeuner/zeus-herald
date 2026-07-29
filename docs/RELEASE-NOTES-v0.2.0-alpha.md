# Release notes - v0.2.0-alpha

Historical release notes for the first alpha with ingest and motion support.

## Highlights

- Reolink snapshot ingest and optional UpCam snapshot ingest.
- Folder-based camera pipeline: `images/received/`, `images/filtered/`, `images/sent/`.
- Motion routing with confirmation, cooldown, brightness gates, and notifier fan-out.
- Telegram and ntfy mobile delivery through the shared notifier hub.
- CI-safe end-to-end pipeline tests.

## Notes

The current `main` branch contains additional improvements after this tag, including JPEG pixel comparison, ROI polygons, shared image compression, cleanup, Telegram chat-id helper, and ZIP deployment. See the current README and configuration documentation for the latest supported behavior.

## Install

```bash
git checkout v0.2.0-alpha
cp .env.example .env
npm install
npm test
```
