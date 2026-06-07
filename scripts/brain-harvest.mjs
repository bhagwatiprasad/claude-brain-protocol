#!/usr/bin/env node
// Brain Protocol - background insight harvester (per-response).
// Reads NEW transcript messages since its watermark, asks the SESSION'S DEFAULT MODEL (the latest,
// best model - same as chat; NO downgrade) to extract DURABLE decisions/insights, and appends
// candidates to a LOCAL review inbox (.claude/brain/_inbox.md) - never directly to the canonical
// record. The main model promotes inbox -> ADRs during /brain-capture.
// Spawned detached & recursion-guarded (BRAIN_HARVEST) by the Stop hook. Requires `claude` on PATH;
// no-ops gracefully if absent. Fail-safe: any error => exit 0.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const transcript = process.argv[2];
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const brainDir = join(root, '.claude', 'brain');
  if (!transcript || !existsSync(transcript) || !existsSync(brainDir)) process.exit(0);

  // Watermark: transcript lines already processed (incremental - never reprocess).
  const stateFile = join(brainDir, '.harvest-state.json');
  let processed = 0;
  try { processed = JSON.parse(readFileSync(stateFile, 'utf8')).processed || 0; } catch {}

  const lines = readFileSync(transcript, 'utf8').split('\n').filter(Boolean);
  if (lines.length <= processed) process.exit(0); // nothing new
  const fresh = lines.slice(processed);

  // Best-effort, format-tolerant extraction of user/assistant text from the new lines.
  const texts = [];
  for (const ln of fresh) {
    try {
      const o = JSON.parse(ln);
      const role = o.role || o.type || (o.message && o.message.role);
      let content = (o.content ?? (o.message && o.message.content) ?? o.text);
      if (Array.isArray(content)) content = content.map(c => (typeof c === 'string' ? c : (c.text || ''))).join(' ');
      if (typeof content === 'string' && content.trim() && (role === 'user' || role === 'assistant')) {
        texts.push(`${role}: ${content.trim().slice(0, 4000)}`);
      }
    } catch {}
  }
  // Advance the watermark first so we never reprocess, even if extraction yields nothing.
  try { writeFileSync(stateFile, JSON.stringify({ processed: lines.length })); } catch {}
  if (texts.length === 0) process.exit(0);

  const convo = texts.join('\n').slice(-12000);
  const prompt = [
    'You extract DURABLE decisions/insights from a coding conversation for a project memory.',
    'Keep ONLY things worth remembering long-term: product/architecture decisions, the WHY behind them,',
    'tradeoffs, rejected options, corrected assumptions, or stated intent. Ignore chit-chat, status updates,',
    'and transient task details. Be conservative - prefer fewer, high-signal items.',
    'Output ONLY a JSON array of short strings (one insight each), or [] if nothing qualifies.',
    '',
    'CONVERSATION:',
    convo,
  ].join('\n');

  let out = '';
  try {
    // No --model: inherit the session's default (the latest best model, same as chat) for every stage.
    out = execFileSync('claude', ['-p', prompt], {
      env: { ...process.env, BRAIN_HARVEST: '1' }, // guard: claude's own Stop hook stands down
      encoding: 'utf8', timeout: 120000, stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch { process.exit(0); } // claude CLI missing or failed -> no-op, never breaks the dev flow

  const m = out.match(/\[[\s\S]*\]/);
  if (!m) process.exit(0);
  let items = [];
  try { items = JSON.parse(m[0]); } catch { process.exit(0); }
  items = (Array.isArray(items) ? items : []).filter(s => typeof s === 'string' && s.trim());
  if (items.length === 0) process.exit(0);

  const stamp = new Date().toISOString(); // plain Node hook script - Date is allowed here (not a Workflow)
  const block = `\n## Harvested ${stamp}\n` + items.map(s => `- [ ] ${s.trim()}`).join('\n') + '\n';
  const inbox = join(brainDir, '_inbox.md');
  if (!existsSync(inbox)) {
    try { writeFileSync(inbox, '# Harvested insight inbox (local, unreviewed)\n\nCandidates from the per-response harvester. Promote the real ones to numbered ADRs via /brain-capture, then delete them here. Gitignored.\n'); } catch {}
  }
  try { appendFileSync(inbox, block); } catch {}
} catch {}
process.exit(0);
