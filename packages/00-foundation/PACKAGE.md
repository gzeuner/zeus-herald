# Package 00 – Foundation

## Goal
Create the clean repository skeleton for zeus-herald and the multi-agent working environment.

## Tasks

1. Initialize git repo (or new branch `zeus-herald` / new GitHub repo).
2. Add MIT LICENSE, README.md (root), .gitignore (Node + Java + .local + .env + images + state).
3. Create directory layout:
   ```
   src/
   src/notifiers/
   docs/
   agents/
   packages/          (this tree can stay as reference)
   .local/            (gitignored)
   test/
   ```
4. Copy agent protocol and architecture docs into `docs/` and `agents/`.
5. Add `.env.example` with TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, NTFY_URL.
6. Add minimal `package.json` (Node 20+, type module or commonjs – decide in ADR).
7. Optional: GitHub Actions skeleton (lint + test placeholder).

## Acceptance

- [ ] `git status` clean after first commit
- [ ] `.local/` is gitignored
- [ ] Architect has written ADR-001 (repo layout & module system)
- [ ] Reviewer has approved structure
- [ ] Coordinator marks package DONE

## Handoff note template
See `templates/HANDOFF.md`
