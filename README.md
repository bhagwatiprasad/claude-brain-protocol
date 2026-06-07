# Brain Protocol — a Claude Code plugin

**Self-maintaining project knowledge.** Commit the durable **WHY** (what the project is, who it's for, the decisions). Regenerate the volatile **HOW** (architecture maps) as a *local, gitignored cache* — like `dist/`. The result: understanding that compounds across sessions, stays honest as code moves, and **never breaks across branches**.

> Built on one principle: **commit only what code can't regenerate.**

---

## Why this design

Most "project memory" rots because it tries to keep a committed, hand-maintained snapshot of *how the code works* — which goes stale the moment code changes, and conflicts the moment two people work on two branches.

This plugin splits knowledge by a single test — *can code regenerate this?*

| Tier | Lives in | In git? | Why |
|------|----------|---------|-----|
| **WHY** — `product/` + `decisions/` + `INDEX.md` | the repo | ✅ committed | Code can't supply intent/rationale. Append-only + durable → ~zero merge conflict. |
| **HOW** — `architecture/` (+ `_provenance.json`) | the repo, **gitignored** | ❌ local cache | A build artifact derived from code. Regenerated on demand; never merged. |
| **Bookkeeping** — `.sync-state.json`, `.harvest-state.json`, `_inbox.md` | the repo, **gitignored** | ❌ local | Per-clone state; the HOW checkpoint is local → branch/squash-safe. |

Because the only brain content in git is **append-only or durable**, it sits in git's sweet spot — no cross-branch merge pain, no squash-blindness, no global ADR-number collisions on the derived layer.

---

## What's in the box

- **Hooks** (`hooks/hooks.json` → `scripts/`)
  - `SessionStart` → reports whether the local HOW cache is current with code; directs `/brain-protocol:brain-sync` if it drifted, is absent (fresh clone), or its checkpoint is unreachable (squash/rebase). Never claims "current" when it can't prove it.
  - `Stop` → fires a detached, recursion-guarded **insight harvester** that extracts durable WHY candidates from the conversation into a local `_inbox.md`. It does **not** block or nag.
- **Skills** (slash commands, namespaced `/brain-protocol:*`)
  - `/brain-protocol:brain-index` — first-contact full index (or full re-baseline).
  - `/brain-protocol:brain-sync` — regenerate the local HOW cache from current code.
  - `/brain-protocol:brain-capture` — append the WHY (promote inbox → numbered ADRs, rebuild the digest).

All brain work runs **in-session on the session's default (latest, best) model** — no downgrade.

---

## Install

```bash
# 1) Add this repo as a plugin marketplace (one-time)
/plugin marketplace add REPLACE_WITH_YOUR_GITHUB/claude-brain-protocol

# 2) Install the plugin
/plugin install brain-protocol@brain-protocol-marketplace
```

To try it locally before publishing:

```bash
claude --plugin-dir /path/to/claude-brain-protocol
# and validate the manifest/hooks schema:
claude plugin validate /path/to/claude-brain-protocol
```

Then, in any repo: the `SessionStart` hook will either say "no brain — run `/brain-protocol:brain-index`" or report cache drift. Follow the directive.

---

## What lands in *your* project (vs the plugin)

The plugin ships **only the engine** (scripts + skills + hooks). The *knowledge it generates* lives in **your** repo under `.claude/brain/`:

```
<your-repo>/.claude/brain/
├── product/overview.md       # committed — durable WHY (the gold)
├── decisions/                # committed — append-only ADR log + CURRENT.md
├── INDEX.md                  # committed — the map
├── .gitignore                # committed — ignores the local tier below
├── architecture/             # LOCAL (gitignored) — regenerated HOW cache
├── .sync-state.json          # LOCAL — the HOW checkpoint (archCommit)
├── .harvest-state.json       # LOCAL — harvester watermark
└── _inbox.md                 # LOCAL — unreviewed WHY candidates
```

`brain-index` writes that `.gitignore` for you. The plugin **never** writes into its own directory; it resolves your project via the `CLAUDE_PROJECT_DIR` environment variable and writes only under `<project>/.claude/brain/`.

---

## How it sustains across parallel branches

Two developers on two branches never merge `architecture/` (it's a local cache), never collide on a checkpoint SHA (it's local), and never inherit a stale committed map. Each clone regenerates its own HOW from whatever code it's looking at, with one `/brain-protocol:brain-sync`. Knowledge integrates where code integrates; the cache is rebuilt, not reconciled.

*Trade-off (accepted):* a fresh clone has no `architecture/` until one `/brain-protocol:brain-sync` — but the durable WHY loads instantly from git, and a regenerated map is never stale (unlike a committed one that rots).

---

## Rule 0 (the protocol, in full)

> This is the always-on contract the skills and hooks implement. Plugins can't auto-inject an always-on rule into every session, so it's documented here; the behavior is enforced by the hooks (which print directives) and the skills (which encode the procedure).

**Layers (split by how fast they rot)**
- `product/` — DURABLE "why": what it is, who for, value, business model, key decisions. Hand-curated. The gold; code can't supply it.
- `architecture/` — VOLATILE "how": system map, data model, flows. **Regenerated, never hand-frozen.** A local, gitignored build artifact, stamped with the commit it was derived from.
- `decisions/` — append-only ADR log: the compounding delta. `CURRENT.md` is the effective-only digest, rebuilt incrementally.

**Lifecycle**
- **First open / no brain** → auto-index (`brain-index`): committed WHY + local HOW cache + stamp `archCommit`.
- **Session start** → check the LOCAL `archCommit` against code. Absent / drifted / unreachable → regenerate via `brain-sync`. Re-verify any stale "how" claim against the live file before trusting it.
- **During the session** → treat `architecture/` as a **cache, not scripture**. Before relying on a "how" claim touching changed code, re-read the live file or `brain-sync`.
- **After each response** → the harvester appends conversational WHY candidates to local `_inbox.md` (no blocking).
- **When real decisions/intent conclude** → `brain-capture`: promote inbox → ADRs, rebuild `CURRENT.md`, update `product/` only if intent changed. **Write-only — the user commits the WHY.**

**Anti-rot invariants (non-negotiable)**
1. Commit only what code can't regenerate. WHY committed; HOW is a local, regenerated cache.
2. Never present a stale `architecture/` claim as current — re-read the live file or `brain-sync` first.
3. The HOW is regenerated, never hand-merged or hand-frozen.
4. `decisions/` is append-only — supersede, never overwrite.
5. Write-only: the plugin never commits/stages; the developer commits the WHY.
6. The HOW checkpoint (`archCommit`) is local — branch/squash-safe. If unreachable, treat the cache as STALE, never "current".
7. Proportionality: full index for real code, scope huge repos, skip trivial one-offs.
8. Every brain stage runs on the session's default (latest, best) model — no downgrade.

> Brain is a **cache with invalidation, not scripture.** Confident-but-stale is worse than empty.

---

## Status & caveats

- **Validate before publishing.** The exact `hooks.json` command schema and `marketplace.json` source format are the parts most likely to be version-sensitive — run `claude plugin validate` and a local `claude --plugin-dir` smoke test (confirm the `SessionStart` line prints, and a `/brain-protocol:*` command resolves) before relying on a published version.
- **`claude` on PATH.** The background harvester shells out to `claude -p`; if the CLI isn't on PATH it no-ops gracefully (the rest of the protocol still works).
- Fill in the `REPLACE_WITH_YOUR_*` placeholders in `.claude-plugin/plugin.json` and `marketplace.json` before publishing.

## License

MIT (edit to taste).
