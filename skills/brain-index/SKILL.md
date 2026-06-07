---
name: brain-index
description: First-contact full index of a project — fan out parallel readers across every subsystem, synthesize an evidence-backed product + architecture understanding, and write it into the repo's .claude/brain/. Use on first open (auto-surfaced by the SessionStart hook when no brain exists) or to fully re-baseline. Part of the Brain Protocol (see the plugin README).
---

# brain-index — bootstrap or re-baseline the project brain

## When
- First open with no `.claude/brain/` (the SessionStart hook directs this automatically), or a full re-baseline. Scope effort to repo size; skip trivial one-offs.

## Steps
1. **Scout (inline).** Read the manifest, route/page map, models/schemas, and API surface across every source root in the repo (whatever they are — `src/`, `app/`, `server/`, `infra/`, etc.; discover them, don't assume). Capture seed ground-truth (true product name, stack, domain hierarchy).
2. **Fan out parallel readers** (one per subsystem): domain/data model • user experience • auth & access • admin/authoring • pipeline & integrations • infra/SEO/stage (adapt to what this repo actually has). Each returns: summary, capabilities, entities/flows, access/roles, businessSignals, surprises, evidence (file:line). For real codebases drive this with the Workflow tool (readers → synthesize → adversarial critique → finalize).
3. **Synthesize.** Separate what code PROVES vs SUGGESTS vs CANNOT show. Resolve contradictions. Truth over comfort.
4. **Critique.** At least one skeptic pass for unsupported claims + one for completeness. Apply fixes.
5. **Write the brain.** Two tiers split by "can code regenerate this?":
   - **COMMITTED (the gold — git-shared):** `brain/product/*.md` (durable why), `brain/decisions/0001-initial-index.md` + `brain/decisions/CURRENT.md`, `brain/INDEX.md`, and `brain/.gitignore`.
   - **LOCAL (gitignored build artifact — like `dist/`, never shared/merged):** `brain/architecture/*.md` (volatile how) + `brain/architecture/_provenance.json` (per-entry `dependsOn` globs). Stamp the local checkpoint `brain/.sync-state.json` → `{ "archCommit": "<git rev-parse --short HEAD>" }`.
   - `brain/.gitignore` ignores: `architecture/`, `.sync-state.json`, `.harvest-state.json`, `_inbox.md`.
6. **Wire the loader.** Ensure the repo `CLAUDE.md` `@import`s ONLY `.claude/brain/INDEX.md` + `.claude/brain/product/overview.md` (keep startup context small; architecture is local + read on demand).
7. **Write-only.** Leave the files in the working tree. **Do NOT commit or stage** — tell the user to commit the WHY (`product/` + `decisions/` + `INDEX.md`); `architecture/` stays local by construction (gitignored). Runs in-session on the chat's own (latest, best) model — every stage.

## Output
A tight executive synthesis to the user; depth lives in the files.
