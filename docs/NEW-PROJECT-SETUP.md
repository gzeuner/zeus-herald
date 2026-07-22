# How to bootstrap zeus-herald

## Option A – New GitHub repository (recommended)

1. Create empty public repo `zeus-herald` under the desired owner (e.g. gzeuner).
2. Clone it locally.
3. Copy the contents of this zip (except the outer folder) into the clone.
4. `git add -A && git commit -m "chore: initial scaffold for zeus-herald"`
5. Push and protect `main`.

## Option B – New branch inside existing upcam-client

```bash
cd C:\Java\workspace-java\upcam-client
git checkout -b zeus-herald
# then copy scaffold files, adjust .gitignore, commit
```

## Placing the roadmap into the legacy project

```bash
# inside upcam-client
mkdir -p .local
# copy .local/ROADMAP.md and ROADMAP-STATUS.md from this package
# ensure .local/ is in .gitignore
```

## First agent run (Grok CLI)

1. Coordinator reads `.local/ROADMAP.md` + `ROADMAP-STATUS.md`
2. Picks package `00-foundation`
3. Invokes Architect → Implementer → Reviewer → Tester cycle
4. Updates status only after sign-offs

All subsequent work stays inside the new project / branch.
