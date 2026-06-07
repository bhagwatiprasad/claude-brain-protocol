---
name: brain-sync
description: Regenerate a project's LOCAL "how" cache (architecture/) from current code, pinned to a local checkpoint. architecture/ is a gitignored build artifact (like dist/) — never merged, never committed. Auto-surfaced by the SessionStart hook when the cache drifts from code; run on demand any time. Runs in-session on the chat's own (latest, best) model. Part of the Brain Protocol (see the plugin README).
---

# brain-sync — regenerate the local HOW cache (architecture/)

`architecture/` is a **local, gitignored build artifact** derived from code — like `dist/`. It never enters git, so it can't conflict across branches, go squash-blind, or fork per branch. This skill **regenerates** it; it never merges it and never commits. The WHY (`product/`, `decisions/`) is committed and is NOT touched here.

Runs **in-session on this chat's own model + thinking effort** (the latest, best default — no downgrade). Every stage uses that model.

## Steps
1. **Read the checkpoint.** `.claude/brain/.sync-state.json` → `archCommit` (the commit the cache was last built from; local, always reachable). If it's missing, unreachable (`git rev-parse --verify --quiet <archCommit>^{commit}` empty — squash/rebase/shallow), or `architecture/system-map.md` is absent (fresh clone) → **full rebuild**: regenerate every architecture map from live code.
2. **Diff.** Otherwise `git diff --name-only <archCommit>..HEAD` + `git status --porcelain`. For each `architecture/*.md`, if a changed file matches its `dependsOn` globs (in `architecture/_provenance.json`), it is stale.
3. **Regenerate, don't merge.** Re-derive each stale `architecture/*.md` from the **live code** (read the real files; for big sweeps drive it with the Workflow tool). Overwrite the local file wholesale — never hand-patch a derived map.
4. **Re-stamp provenance** (local): refresh `architecture/_provenance.json` `derivedAtCommit`/`dependsOn`.
5. **Advance the checkpoint.** Write `.claude/brain/.sync-state.json` → `{ "archCommit": "<git rev-parse --short HEAD>" }`.
6. **Boundaries.** Never touch `product/` or `decisions/` (that's the committed WHY — use `/brain-protocol:brain-capture`). Never commit or stage; `architecture/` is gitignored anyway, so it stays local by construction.
