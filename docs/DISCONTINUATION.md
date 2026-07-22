# Official Discontinuation Notice

## upcam-client & SnapShotter

**Date:** 2026-07-22  
**Decision:** Active feature development on the current architecture is discontinued.

### Reasons

1. Heavy dependency on whatsapp-web.js / Puppeteer caused continuous breakage and high maintenance cost.
2. Memory and process-lifecycle issues (Chromium, session locks) made 24/7 operation fragile.
3. The two-repo + submodule setup increased operational complexity.
4. A cleaner, more reliable successor architecture (Telegram + ntfy, pluggable notifiers) is now preferred.

### What this means

- **No new features** will be added to `gzeuner/upcam-client` or `gzeuner/SnapShotter`.
- Security fixes and critical bugfixes *may* still be applied if necessary.
- Existing installations continue to work; users are encouraged to migrate to **zeus-herald**.
- The legacy repositories remain public and MIT-licensed for archival and reference purposes.

### Migration path

1. Read the zeus-herald roadmap and architecture documents.
2. Follow the packages under `packages/` (ordered).
3. Secrets and local state stay under `.local/` and are never committed.

### README snippet to add to legacy projects

```markdown
> **Note (2026-07):** Active development has moved to the successor project **zeus-herald**.
> This repository is in maintenance-only mode. See the discontinuation notice for details.
```
