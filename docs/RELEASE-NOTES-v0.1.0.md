# Release notes - v0.1.0

Historical release notes for the initial notifier-hub baseline.

## Highlights

- Node.js 20+ project scaffold with ESM modules.
- Telegram Bot API and ntfy notifier adapters.
- Pluggable notifier hub with isolated channel failures.
- Env-first configuration and secret redaction.
- Bounded queue, health file, heartbeat, and graceful shutdown.
- Automated check against WhatsApp Web and browser-automation runtime dependencies.

## Install

```bash
git checkout v0.1.0
cp .env.example .env
npm install
npm test
```
