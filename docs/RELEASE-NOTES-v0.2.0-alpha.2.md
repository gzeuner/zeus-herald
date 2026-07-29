# Release notes - v0.2.0-alpha.2

## Highlights

- Reolink camera motion state can now act as the primary trigger for event delivery.
- Ingest can poll camera motion state and capture a short snapshot burst only while the camera reports motion.
- Motion processing now reads ingest sidecars and can send camera-triggered frames immediately, even before pixel comparison has a baseline.
- Default tuning is faster and broader: shorter polling, shorter burst intervals, full-frame ROI by default, higher send allowance, and less aggressive image compression.
- Configuration and operations documentation were updated for the camera-motion-first flow and ZIP deployment.

## Upgrade Notes

- Review `.env.example` and update deployment `.env` values for `REOLINK_MOTION_STATE_*`, `REOLINK_BURST_*`, `INGEST_INTERVAL_MS`, `MOTION_POLL_MS`, `MOTION_ROI_POLYGONS_JSON`, and notifier image compression.
- Empty `MOTION_ROI_POLYGONS_JSON` means full-frame evaluation.
- ZIP deployment still includes the local `.env` by default and must be handled as private deployment material.

## Verification

```bash
npm run lint
npm test
npm run deploy:zip
```