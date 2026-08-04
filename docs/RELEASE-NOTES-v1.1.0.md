# Release Notes v1.1.0

Network resource safety and resilient long-running operation.

## Changes

- Serialized camera requests so fast burst capture cannot overlap and create an uncontrolled socket load.
- Serialized Telegram and ntfy sends with their health checks per notifier.
- Added exponential backoff after repeated camera network failures while preserving the configured interval during healthy operation.
- Added request-gate test coverage.

## Validation

- `npm run lint`
- `npm test` (85 tests)

## Packaging

Deployment ZIPs are intentionally not part of the release commit. Create them only explicitly with `npm run deploy:zip` on the deployment machine, because local ZIPs may include the production `.env`.
