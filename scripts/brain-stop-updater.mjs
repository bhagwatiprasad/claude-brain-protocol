#!/usr/bin/env node
// Brain Protocol - Stop hook (cross-platform Node). One job: fire-and-forget the per-response
// insight harvester (background, recursion-guarded) so conversational WHY (decisions, rejected
// options, corrected assumptions) is captured to the local review inbox.
//
// It does NOT block or nag: the HOW (architecture/) self-heals via /brain-sync at session start,
// and the WHY is captured deliberately. Loop-safe (BRAIN_HARVEST + stop_hook_active). Fail-open => exit 0.
//
// Locates the harvester as a SIBLING via import.meta.url, so it works both bundled in a plugin
// (scripts/) and in-repo (.claude/hooks/) with no path assumptions. The harvester writes only into
// the target project's .claude/brain/ (resolved from CLAUDE_PROJECT_DIR, forwarded below).
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const done = () => process.exit(0);

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  try { for await (const c of process.stdin) chunks.push(c); } catch {}
  return Buffer.concat(chunks).toString();
}

(async () => {
  try {
    if (process.env.BRAIN_HARVEST) return done(); // never recurse from the harvester's own claude session

    let payload = {};
    try { payload = JSON.parse((await readStdin()) || '{}'); } catch {}
    if (payload.stop_hook_active) return done(); // block-continue loop guard

    const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
    const brainDir = join(root, '.claude', 'brain');
    if (!existsSync(brainDir)) return done(); // no brain in this project -> nothing to harvest

    // Fire the background insight harvester (non-blocking, detached, output discarded).
    try {
      const here = dirname(fileURLToPath(import.meta.url));
      const harvest = join(here, 'brain-harvest.mjs'); // sibling: plugin scripts/ OR in-repo .claude/hooks/
      if (payload.transcript_path && existsSync(harvest)) {
        spawn(process.execPath, [harvest, payload.transcript_path], {
          cwd: root, detached: true, stdio: 'ignore',
          env: { ...process.env, BRAIN_HARVEST: '1', CLAUDE_PROJECT_DIR: root },
        }).unref();
      }
    } catch {}
  } catch {}
  done();
})();
