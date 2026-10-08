/**
 * fix-prompt-size.test.js
 *
 * End-to-end tests for the size-aware prompt that `allycat fix` hands to Claude.
 * Written from the approved spec BEFORE the implementation (test-first).
 *
 * Spec summary (limits come from the fix-prompt experiment: one session fixed
 * 89 violations at about a third of the cost of 5 agents):
 *   - Every prompt says "targeted fixes" and "work rule by rule"
 *   - No agents while violations <= 300 AND files <= 50
 *   - Otherwise agents = max(ceil(violations / 300), ceil(files / 50)),
 *     clamped to 2..8 and never more than the number of files
 *   - The hint names the exact count: "across exactly N subagents"
 *   - Each agent reports back in 5 lines or fewer
 *   - No "tell the user how you split it" step
 *   - Files are counted as distinct `file` strings; violations without one are skipped
 *   - All violations in one file → no agents (nothing to split)
 *   - Error cases (no scan, bad scan, other folder, no Claude, nothing to fix) are unchanged
 *
 * Not automated here: the paste-able fallback is covered by terminal-opener.test.js.
 *
 * Usage:
 *   node tests/e2e/fix-prompt-size.test.js
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeFakeClaudeDir, withoutPath } from './helpers/fakeClaude.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT      = path.join(__dirname, '../..');
const CLI       = path.join(ROOT, 'src', 'index.js');
const SCAN_FILE = 'allycat-last-scan.json';

const FAKE_CLAUDE_DIR = makeFakeClaudeDir();
const NODE_DIR        = path.dirname(process.execPath);

const BASE_RULE_BY_RULE = 'rule by rule';
const NO_REWRITE        = 'Do not rewrite whole files';
const SUBAGENT          = 'subagent';
const ONE_FILE_PER_AGENT = 'never giving the same file to two agents';
const SHORT_REPORT      = 'report back in 5 lines or fewer';
const ANNOUNCE_SPLIT    = 'tell the user how you split it';

/** The exact-count phrase the hint must contain. */
const agentsPhrase = (n) => `across exactly ${n} subagents`;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeTmpDir(prefix = 'allycat-prompt-size-') {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function writeSaved(tmpDir, data) {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    fs.writeFileSync(path.join(tmpDir, SCAN_FILE), content, 'utf8');
}

/**
 * `total` violations spread round-robin across `fileCount` files.
 * The files don't need to exist: the freshness check only warns.
 */
function violationsAcross(fileCount, total) {
    return Array.from({ length: total }, (_, i) => ({
        file: `src/f${i % fileCount}.html`,
        line: 10 + i,
        rule: 'image-alt',
        impact: 'critical',
        description: 'Ensure <img> elements have alternative text',
    }));
}

/** Write a valid scan for this repo with the given violations. */
function writeScan(tmpDir, violations) {
    writeSaved(tmpDir, { scannedAt: new Date().toISOString(), cwd: ROOT, violations });
}

/**
 * Run `allycat fix` without ever opening a terminal.
 * PATH holds only node and (unless `claudeInstalled` is false) a fake claude.
 */
function runFix(tmpDir, { claudeInstalled = true } = {}) {
    const env = { ...withoutPath(process.env), ALLYCAT_TMPDIR: tmpDir, ALLYCAT_NO_LAUNCH: '1', NO_COLOR: '1' };
    env.PATH = (claudeInstalled ? [FAKE_CLAUDE_DIR, NODE_DIR] : [NODE_DIR]).join(path.delimiter);
    const result = spawnSync(process.execPath, [CLI, 'fix'], { encoding: 'utf8', cwd: ROOT, env });
    return { status: result.status, output: (result.stdout || '') + (result.stderr || '') };
}

/** The prompt from the `claude "..."` line ALLYCAT_NO_LAUNCH prints, or null. */
function promptFrom(output) {
    const line = output.split(/\r?\n/).find((l) => l.startsWith('claude "'));
    if (!line) return null;
    return line.slice('claude "'.length, line.lastIndexOf('"'));
}

/** Run `fix` on `violations` and return its exit status and prompt ('' if none). */
function promptFor(violations) {
    const tmp = makeTmpDir();
    writeScan(tmp, violations);
    const { status, output } = runFix(tmp);
    return { status, output, prompt: promptFrom(output) ?? '' };
}

// -----------------------------------------------------------------------------
// Assertions
// -----------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label, ok, detail = '') {
    console.log(`  ${ok ? '✓' : '✗'}  ${label}`);
    if (!ok && detail) console.log(`       ${detail}`);
    ok ? passed++ : failed++;
}

function assertExit(label, actual, expected) {
    assert(label, actual === expected, `expected exit ${expected}, got ${actual}`);
}

function assertContains(label, text, substring) {
    assert(label, text.includes(substring), `expected to contain: "${substring}"\n       got: "${text}"`);
}

function assertNotContains(label, text, substring) {
    assert(label, !text.toLowerCase().includes(substring.toLowerCase()), `expected NOT to contain: "${substring}"\n       got: "${text}"`);
}

// =============================================================================
// Small scans: one session, no agents
// =============================================================================

console.log('\n-- 1: 3 violations in 1 file → base prompt only -----------------');
{
    const { status, prompt } = promptFor(violationsAcross(1, 3));
    assertExit('exit 0', status, 0);
    assertContains('keeps "targeted"', prompt, 'targeted');
    assertContains('adds "rule by rule"', prompt, BASE_RULE_BY_RULE);
    assertNotContains('no subagent hint', prompt, SUBAGENT);
}

console.log('\n-- 2: 89 violations / 15 files (the experiment run) → no hint ---');
{
    const { status, prompt } = promptFor(violationsAcross(15, 89));
    assertExit('exit 0', status, 0);
    assertContains('base prompt present', prompt, BASE_RULE_BY_RULE);
    assertNotContains('no subagent hint', prompt, SUBAGENT);
}

console.log('\n-- 3: exactly 300 violations / 50 files (both at limit) → no hint');
{
    const { status, prompt } = promptFor(violationsAcross(50, 300));
    assertExit('exit 0', status, 0);
    assertNotContains('no subagent hint', prompt, SUBAGENT);
}

// =============================================================================
// Large scans: exact agent count
// =============================================================================

console.log('\n-- 4: 301 violations / 20 files → exactly 2 agents --------------');
{
    const { status, prompt } = promptFor(violationsAcross(20, 301));
    assertExit('exit 0', status, 0);
    assertContains('base prompt present', prompt, BASE_RULE_BY_RULE);
    assertContains('names 2 agents', prompt, agentsPhrase(2));
    assertContains('hint names the file count', prompt, 'This touches 20 files');
    assert('hint comes after the base prompt',
        prompt.indexOf(NO_REWRITE) !== -1 && prompt.indexOf(NO_REWRITE) < prompt.indexOf(SUBAGENT),
        `got: "${prompt}"`);
}

console.log('\n-- 5: 100 violations / 51 files (files over limit) → 2 agents ---');
{
    const { status, prompt } = promptFor(violationsAcross(51, 100));
    assertExit('exit 0', status, 0);
    assertContains('names 2 agents', prompt, agentsPhrase(2));
    assertContains('hint names the file count', prompt, 'This touches 51 files');
}

console.log('\n-- 6: 1,200 violations / 40 files → exactly 4 agents ------------');
{
    const { status, prompt } = promptFor(violationsAcross(40, 1200));
    assertExit('exit 0', status, 0);
    assertContains('names 4 agents', prompt, agentsPhrase(4));
}

console.log('\n-- 7: 400 violations / 250 files → files decide: 5 agents -------');
{
    // ceil(400 / 300) = 2, ceil(250 / 50) = 5 → the larger wins
    const { status, prompt } = promptFor(violationsAcross(250, 400));
    assertExit('exit 0', status, 0);
    assertContains('names 5 agents', prompt, agentsPhrase(5));
}

console.log('\n-- 8: 5,000 violations / 400 files → capped at 8 agents ---------');
{
    const { status, prompt } = promptFor(violationsAcross(400, 5000));
    assertExit('exit 0', status, 0);
    assertContains('names 8 agents', prompt, agentsPhrase(8));
}

console.log('\n-- 9: large scan keeps the safety rules, asks for short reports --');
{
    const { prompt } = promptFor(violationsAcross(20, 301));
    assertContains('still says not to rewrite whole files', prompt, NO_REWRITE);
    assertContains('one file per agent', prompt, ONE_FILE_PER_AGENT);
    assertContains('agents report back briefly', prompt, SHORT_REPORT);
    assertNotContains('no "tell the user how you split it" step', prompt, ANNOUNCE_SPLIT);
}

// =============================================================================
// Edge cases
// =============================================================================

console.log('\n-- 10: 400 violations all in 1 file → no hint (nothing to split)');
{
    const { status, prompt } = promptFor(violationsAcross(1, 400));
    assertExit('exit 0', status, 0);
    assertContains('base prompt present', prompt, BASE_RULE_BY_RULE);
    assertNotContains('no subagent hint', prompt, SUBAGENT);
}

console.log('\n-- 11: 900 violations / 2 files → never more agents than files --');
{
    // ceil(900 / 300) = 3, but there are only 2 files to hand out
    const { status, prompt } = promptFor(violationsAcross(2, 900));
    assertExit('exit 0', status, 0);
    assertContains('names 2 agents', prompt, agentsPhrase(2));
}

console.log('\n-- 12: repeated paths count once --------------------------------');
{
    // 302 violations over 2 distinct paths: large by violations, so the hint
    // shows the file count — which must be 2, not 302.
    const violations = [
        ...violationsAcross(1, 151).map((v) => ({ ...v, file: 'src/a.html' })),
        ...violationsAcross(1, 151).map((v) => ({ ...v, file: 'src/b.html' })),
    ];
    const { status, prompt } = promptFor(violations);
    assertExit('exit 0', status, 0);
    assertContains('counts 2 distinct files', prompt, 'This touches 2 files');
    assertContains('names 2 agents', prompt, agentsPhrase(2));
}

console.log('\n-- 13: violations without a file are skipped, not crashed on ----');
{
    const noFile = Array.from({ length: 5 }, (_, i) => ({ line: i + 1, rule: 'region', impact: 'moderate' }));
    const { status, prompt } = promptFor([...violationsAcross(10, 300), ...noFile]);
    assertExit('exit 0', status, 0);
    assertContains('file count ignores them', prompt, 'This touches 10 files');
    assertContains('violation count includes them', prompt, '305 violations');
    assertContains('names 2 agents', prompt, agentsPhrase(2));
}

// =============================================================================
// Error cases — unchanged, and never a prompt
// =============================================================================

console.log('\n-- 14a: no saved scan → exit 1, no prompt -----------------------');
{
    const { status, output } = runFix(makeTmpDir());
    assertExit('exit 1', status, 1);
    assert('no claude command', promptFrom(output) === null);
    assertNotContains('no subagent text', output, SUBAGENT);
}

console.log('\n-- 14b: unreadable saved scan → exit 1, no prompt ---------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, '{ not json');
    const { status, output } = runFix(tmp);
    assertExit('exit 1', status, 1);
    assert('no claude command', promptFrom(output) === null);
    assertNotContains('no subagent text', output, SUBAGENT);
}

console.log('\n-- 14c: scan from another folder → exit 1, no prompt ------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, { scannedAt: new Date().toISOString(), cwd: makeTmpDir('allycat-other-'), violations: violationsAcross(12, 60) });
    const { status, output } = runFix(tmp);
    assertExit('exit 1', status, 1);
    assert('no claude command', promptFrom(output) === null);
    assertNotContains('no subagent text', output, SUBAGENT);
}

console.log('\n-- 14d: Claude Code not installed → exit 1, no prompt -----------');
{
    const tmp = makeTmpDir();
    writeScan(tmp, violationsAcross(12, 60));
    const { status, output } = runFix(tmp, { claudeInstalled: false });
    assertExit('exit 1', status, 1);
    assert('no claude command', promptFrom(output) === null);
    assertNotContains('no subagent text', output, SUBAGENT);
}

console.log('\n-- 15: zero violations → "Nothing to fix", no prompt ------------');
{
    const tmp = makeTmpDir();
    writeScan(tmp, []);
    const { status, output } = runFix(tmp);
    assertExit('exit 0', status, 0);
    assertContains('says nothing to fix', output, 'Nothing to fix');
    assert('no claude command', promptFrom(output) === null);
    assertNotContains('no subagent text', output, SUBAGENT);
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
