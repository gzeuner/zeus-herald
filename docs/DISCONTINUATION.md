# Discontinuation Notice

Active feature development for the previous `upcam-client` / SnapShotter / WhatsApp-Web based architecture has moved to Zeus Herald.

## Reasons

- Browser automation around WhatsApp Web is fragile for unattended operation.
- Chromium-based runtimes increase memory use and operational complexity.
- Official HTTP/APIs are easier to monitor and recover.
- Camera ingest, motion detection, and mobile delivery are now maintained in one repository.

## Current Recommendation

Use Zeus Herald for new development and deployments that can use Telegram, ntfy, or both as notification channels.

Existing legacy installations can continue to run independently, but new feature work should target Zeus Herald.

## Migration

See [MIGRATION.md](MIGRATION.md).
