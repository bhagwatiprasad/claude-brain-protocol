#!/usr/bin/env node
// Brain Protocol - SessionStart hook (cross-platform Node). Reports whether the LOCAL "how" cache
// (architecture/) is current with code.
//
// Model: the WHY (product/ + decisions/) is committed; the HOW (architecture/) is a LOCAL, gitignored
// build artifact regenerated from code - like dist/. Its checkpoint (the commit it was built from)
// lives in the LOCAL .sync-state.json (archCommit), so it is branch/squash-safe and never conflicts.
// Drift => direct an in-session /brain-sync (which runs on the chat's own model + thinking - no
// downgrade). Uses execFileSync (no shell). Always exits 0 (fail-open). Writes nothing.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const git = (args) => {
    try { return execFileSync('git', args, { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString(); }
    catch { return ''; }
  };
  if (!git(['rev-parse', 'HEAD']).trim()) process.exit(0); // not a git repo

  const brainDir = join(root, '.claude', 'brain');
  if (!existsSync(brainDir)) {
    console.log('[brain] No project brain found. Per the Brain Protocol, AUTO-INDEX this project now: run /brain-protocol:brain-index to build .claude/brain/ (committed product + decisions, local architecture cache) before other substantive work. Skip only for a throwaway / non-project repo.');
    process.exit(0);
  }

  // Surface pending harvested insights (WHY candidates) awaiting promotion.
  try {
    const inbox = join(brainDir, '_inbox.md');
    if (existsSync(inbox)) {
      const pend = (readFileSync(inbox, 'utf8').match(/- \[ \]/g) || []).length;
      if (pend > 0) console.log(`[brain] ${pend} harvested insight(s) await review in .claude/brain/_inbox.md - promote the real ones to ADRs via /brain-protocol:brain-capture.`);
    }
  } catch {}

  const archDir = join(brainDir, 'architecture');
  const head = git(['rev-parse', '--short', 'HEAD']).trim();

  // The HOW cache is gitignored, so a fresh clone won't have it: regenerate locally.
  const haveCache = existsSync(join(archDir, 'system-map.md'));
  if (!haveCache) {
    console.log('[brain] HOW cache (architecture/) is absent locally - it is a regenerated, gitignored build artifact (not shared via git). Run /brain-protocol:brain-sync to rebuild it from current code before relying on the "how". The committed WHY (product/ + decisions/) is already loaded.');
    process.exit(0);
  }

  // Checkpoint = the commit the cache was built from. LOCAL (.sync-state.json), so always reachable
  // and never a merge conflict. Fall back to legacy committed provenance if the marker is missing.
  let checkpoint = '';
  try { checkpoint = JSON.parse(readFileSync(join(brainDir, '.sync-state.json'), 'utf8')).archCommit || ''; } catch {}
  if (!checkpoint) { try { checkpoint = JSON.parse(readFileSync(join(archDir, '_provenance.json'), 'utf8')).indexedAtCommit || ''; } catch {} }
  if (!checkpoint) {
    console.log('[brain] HOW cache present but has no checkpoint - run /brain-protocol:brain-sync to re-stamp it against current code.');
    process.exit(0);
  }

  // Guard: the checkpoint MUST be a reachable commit. After a squash/rebase/shallow-clone it may not
  // be - in which case we CANNOT compute drift and must NOT pretend the cache is current.
  const reachable = git(['rev-parse', '--verify', '--quiet', `${checkpoint}^{commit}`]).trim() !== '';
  if (!reachable) {
    console.log(`[brain] HOW cache checkpoint ${checkpoint} is unreachable (squashed / rebased / shallow clone) - cannot compute drift. Treat architecture/ as STALE and run /brain-protocol:brain-sync to regenerate.`);
    process.exit(0);
  }

  const committed = git(['diff', '--name-only', `${checkpoint}..HEAD`]).split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('.claude/'));
  const uncommitted = git(['status', '--porcelain']).split('\n').map(l => l.slice(3).trim().replace(/^"|"$/g, '')).filter(s => s && !s.startsWith('.claude/'));

  if (committed.length === 0 && uncommitted.length === 0) {
    console.log(`[brain] HOW cache current with code (checkpoint ${checkpoint}).`);
    process.exit(0);
  }
  console.log(`[brain] Code changed since the HOW cache was built (${checkpoint} -> ${head}). architecture/ is a STALE local cache - re-verify any "how" claim against live code, and run /brain-protocol:brain-sync (in-session, on this chat's model) to regenerate it:`);
  if (committed.length) { console.log('  Committed since cache:'); committed.slice(0, 30).forEach(f => console.log('    - ' + f)); }
  if (uncommitted.length) { console.log('  Uncommitted in working tree:'); uncommitted.slice(0, 30).forEach(f => console.log('    - ' + f)); }
} catch {}
process.exit(0);
