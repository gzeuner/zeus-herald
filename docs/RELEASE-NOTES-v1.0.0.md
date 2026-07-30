# Release Notes v1.0.0

First stable release of Zeus Herald.

## Changes

- Notification captions now show the image creation timestamp by default, formatted through the runtime locale and time zone.
- Added optional `NOTIFIER_CAPTION_LOCALE` and `NOTIFIER_CAPTION_TIME_ZONE` overrides for fixed deployments.
- Added `NOTIFIER_CAPTION_DEBUG=false` as an opt-in for technical caption details useful during motion tuning and AI-assisted review.
- Debug captions can include camera/source identity, filename, motion reason, score, changed/compared pixels, brightness, zone status, image dimensions, ROI values, camera motion signal, burst position, and the original internal caption.

## Validation

- `npm run lint`
- `npm test`

## Packaging

Deployment ZIPs are intentionally not part of the release commit. Create them only explicitly with `npm run deploy:zip` on the deployment machine, because local ZIPs may include the production `.env`.