/**
 * fix-prompt-size.test.js
 *
 * End-to-end tests for the size-aware prompt that `allycat fix` hands to Claude.
 * Written from the approved spec BEFORE the implementation (test-first).
 *
 * Spec summary:
 *   - Every prompt keeps today's text and adds "work rule by rule"
 *   - A large scan also gets a hint to split the work by file across subagents:
 *       files >= 10, or violations >= 50 with at least 2 files
 *   - Files are counted as distinct `file` strings; violations without one are skipped
 *   - Error cases (no scan, bad scan, other folder, no Claude, nothing to fix) are unchanged
 *
 * Not automated here: spec #9 (paste-able fallback) is covered by terminal-opener.test.js.
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
// Small scans
// =============================================================================

console.log('\n-- 1: 3 violations in 1 file → base prompt only -----------------');
{
    const { status, prompt } = promptFor(violationsAcross(1, 3));
    assertExit('exit 0', status, 0);
    assertContains('keeps "targeted"', prompt, 'targeted');
    assertContains('adds "rule by rule"', prompt, BASE_RULE_BY_RULE);
    assertNotContains('no subagent hint', prompt, SUBAGENT);
}

console.log('\n-- 2: 9 files, 49 violations (one under both limits) → no hint --');
{
    const { status, prompt } = promptFor(violationsAcross(9, 49));
    assertExit('exit 0', status, 0);
    assertContains('base prompt present', prompt, BASE_RULE_BY_RULE);
    assertNotContains('no subagent hint', prompt, SUBAGENT);
}

// =============================================================================
// Large scans
// =============================================================================

console.log('\n-- 3: exactly 10 files → hint, after the base prompt ------------');
{
    const { status, prompt } = promptFor(violationsAcross(10, 10));
    assertExit('exit 0', status, 0);
    assertContains('base prompt present', prompt, BASE_RULE_BY_RULE);
    assertContains('subagent hint present', prompt, SUBAGENT);
    assertContains('hint names the file count', prompt, 'This touches 10 files');
    assert('hint comes after the base prompt',
        prompt.indexOf(NO_REWRITE) !== -1 && prompt.indexOf(NO_REWRITE) < prompt.indexOf(SUBAGENT),
        `got: "${prompt}"`);
}

console.log('\n-- 4: 50 violations across 3 files → hint -----------------------');
{
    const { status, prompt } = promptFor(violationsAcross(3, 50));
    assertExit('exit 0', status, 0);
    assertContains('subagent hint present', prompt, SUBAGENT);
    assertContains('hint names the file count', prompt, 'This touches 3 files');
}

console.log('\n-- 5: large scan keeps the safety rules -------------------------');
{
    const { prompt } = promptFor(violationsAcross(12, 60));
    assertContains('still says not to rewrite whole files', prompt, NO_REWRITE);
    assertContains('one file per agent', prompt, ONE_FILE_PER_AGENT);
}

// =============================================================================
// Edge cases
// =============================================================================

console.log('\n-- 6: 80 violations all in 1 file → no hint (nothing to split) --');
{
    const { status, prompt } = promptFor(violationsAcross(1, 80));
    assertExit('exit 0', status, 0);
    assertContains('base prompt present', prompt, BASE_RULE_BY_RULE);
    assertNotContains('no subagent hint', prompt, SUBAGENT);
}

console.log('\n-- 7: repeated paths count once ---------------------------------');
{
    // 52 violations over 2 distinct paths: large by violations, so the hint
    // shows the file count — which must be 2, not 52.
    const violations = [
        ...violationsAcross(1, 26).map((v) => ({ ...v, file: 'src/a.html' })),
        ...violationsAcross(1, 26).map((v) => ({ ...v, file: 'src/b.html' })),
    ];
    const { status, prompt } = promptFor(violations);
    assertExit('exit 0', status, 0);
    assertContains('counts 2 distinct files', prompt, 'This touches 2 files');
}

console.log('\n-- 8: violations without a file are skipped, not crashed on -----');
{
    const noFile = Array.from({ length: 5 }, (_, i) => ({ line: i + 1, rule: 'region', impact: 'moderate' }));
    const { status, prompt } = promptFor([...violationsAcross(10, 10), ...noFile]);
    assertExit('exit 0', status, 0);
    assertContains('file count ignores them', prompt, 'This touches 10 files');
    assertContains('violation count includes them', prompt, '15 violations');
}

// =============================================================================
// Error cases — unchanged, and never a prompt
// =============================================================================

console.log('\n-- 10a: no saved scan → exit 1, no prompt -----------------------');
{
    const { status, output } = runFix(makeTmpDir());
    assertExit('exit 1', status, 1);
    assert('no claude command', promptFrom(output) === null);
    assertNotContains('no subagent text', output, SUBAGENT);
}

console.log('\n-- 10b: unreadable saved scan → exit 1, no prompt ---------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, '{ not json');
    const { status, output } = runFix(tmp);
    assertExit('exit 1', status, 1);
    assert('no claude command', promptFrom(output) === null);
    assertNotContains('no subagent text', output, SUBAGENT);
}

console.log('\n-- 10c: scan from another folder → exit 1, no prompt ------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, { scannedAt: new Date().toISOString(), cwd: makeTmpDir('allycat-other-'), violations: violationsAcross(12, 60) });
    const { status, output } = runFix(tmp);
    assertExit('exit 1', status, 1);
    assert('no claude command', promptFrom(output) === null);
    assertNotContains('no subagent text', output, SUBAGENT);
}

console.log('\n-- 10d: Claude Code not installed → exit 1, no prompt -----------');
{
    const tmp = makeTmpDir();
    writeScan(tmp, violationsAcross(12, 60));
    const { status, output } = runFix(tmp, { claudeInstalled: false });
    assertExit('exit 1', status, 1);
    assert('no claude command', promptFrom(output) === null);
    assertNotContains('no subagent text', output, SUBAGENT);
}

console.log('\n-- 11: zero violations → "Nothing to fix", no prompt ------------');
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
