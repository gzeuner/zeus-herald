# ADR-002 – Notifier interface, SendResult, and first adapters

**Status:** Accepted  
**Date:** 2026-07-22  
**Deciders:** Architect (package 01-notifier-core)

## Context

Package 00 established ESM Node 20+ layout. Package 01 must introduce a pluggable notification layer so camera events can be delivered without WhatsApp or browser automation. Architecture already sketched a TypeScript-style `Notifier` contract; this ADR freezes the runtime shape for JavaScript modules and the first two adapters: Telegram Bot API and ntfy HTTP.

Requirements:

- Enable/disable each notifier independently
- At least one successful delivery ⇒ overall success
- Failures isolated (one adapter must not break others)
- Health checks per adapter
- No token/secret logging
- Explicit HTTP timeouts
- Env-first configuration

## Decision

### 1. Duck-typed Notifier contract (JSDoc, no TypeScript yet)

```js
/**
 * @typedef {object} NotifyPayload
 * @property {string} imagePath - absolute or cwd-relative path to image file
 * @property {string} [caption]
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * @typedef {object} SendResult
 * @property {boolean} ok
 * @property {string} notifier - adapter name
 * @property {string} [remoteId] - provider message/id if available
 * @property {string} [error] - safe error message (never tokens)
 * @property {number} [durationMs]
 */

/**
 * @typedef {object} HealthResult
 * @property {boolean} ok
 * @property {string} [detail]
 */

/**
 * Notifier:
 * - readonly name: string
 * - send(payload: NotifyPayload): Promise<SendResult>
 * - health(): Promise<HealthResult>
 */
```

Modules live under `src/notifiers/`. Shared helpers in `base.js` (timeouts, safe errors, result builders). No shared mutable send state between adapters.

### 2. Hub + factory

- `createNotifierHub(config)` builds enabled adapters only.
- `sendAcceptedFrame(imagePath, caption?, metadata?)` fans out with `Promise.allSettled`.
- Overall result: `{ ok: boolean, results: SendResult[] }` where `ok` is true if **≥1** adapter returned `ok: true`.
- If zero adapters enabled → `{ ok: false, results: [], error: 'no_notifiers_enabled' }`.

### 3. Enablement rules (env-first)

| Adapter | Enabled when |
|---------|----------------|
| Telegram | `TELEGRAM_ENABLED` not `false`/`0` **and** both `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` set |
| ntfy | `NTFY_ENABLED` not `false`/`0` **and** `NTFY_URL` set |

Optional: `NOTIFIER_TIMEOUT_MS` (default `30000`).

Config loader: `src/config.js` reads `process.env` only. Start script uses Node’s `--env-file=.env` (no dotenv dependency).

### 4. Telegram adapter

- Official Bot API: `sendPhoto` multipart upload via global `fetch` + `FormData`.
- Health: `getMe`.
- Base URL fixed to `https://api.telegram.org` (no custom API root in v1).
- Errors: map HTTP/API `description` to safe strings; never log the bot token.

### 5. ntfy adapter

- HTTP `PUT` (or `POST`) to `NTFY_URL` with raw image body.
- Headers: `Title`, `Message`/`X-Message`, `Filename`, `Content-Type: image/jpeg` (or sniff from extension).
- Health: lightweight `GET`/`HEAD` against topic URL (2xx/3xx/4xx-from-auth treated carefully; network errors = unhealthy).
- Self-hosted and ntfy.sh both supported via full URL.

### 6. Logging policy

- Structured console logger with levels.
- Redact substrings matching configured secrets before print.
- Never print full Authorization headers or bot tokens.

### 7. Testing

- Unit tests mock global `fetch` (no network).
- Cover success, HTTP failure, timeout/abort, enablement matrix, hub isolation.
- Optional live integration behind `ZEUS_LIVE_NOTIFY=1` (skipped by default).

## Consequences

### Positive

- Clear adapter boundary for future Gotify/email/webhooks.
- Zero browser dependencies; reliability and memory profile stay simple.
- Testable without credentials.

### Negative / Trade-offs

- JSDoc contracts are weaker than TypeScript; acceptable per ADR-001.
- Telegram caption length limits (1024) not enforced yet beyond truncation helper.
- ntfy auth tokens (if self-hosted) deferred (`NTFY_TOKEN` optional later).

## Alternatives considered

1. **grammy / node-telegram-bot-api** – more features; rejected for v1 to keep zero runtime deps and full control over timeouts.
2. **Require all notifiers to succeed** – too strict for multi-channel; partial delivery is better than none.
3. **Queue inside hub** – deferred to package 03 (runtime-hardening).
