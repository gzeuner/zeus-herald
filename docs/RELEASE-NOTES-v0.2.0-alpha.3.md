# Release notes - v0.2.0-alpha.3

## Highlights

- Motion event state now resets after the configured idle gap even when the next frame is already motion-positive.
- This prevents a previous camera-triggered event from blocking a later return movement through `max_sends` or cooldown state.
- Recommended event timing was tuned for quicker repeated approach/departure detection.

## Upgrade Notes

- Review `.env.example` and update deployment `.env` values for `MOTION_COOLDOWN_MS`, `MOTION_MAX_SENDS`, and `MOTION_EVENT_IDLE_MS`.
- The deployment ZIP still includes the local `.env` by default and must be handled as private deployment material.

## Verification

```bash
npm run lint
npm test
npm run deploy:zip
```