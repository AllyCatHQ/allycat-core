/**
 * fix-freshness.test.js
 *
 * End-to-end tests for the `allycat fix` freshness warning.
 * Written from the approved spec BEFORE the implementation (test-first).
 *
 * Spec summary:
 *   - Before opening Claude, `fix` prints: Using scan from <age> (<N> violations)
 *   - If scanned files changed since `scannedAt`, it also prints:
 *       ⚠ <N> files changed since this scan. Run `allycat scan` to refresh.
 *   - Warn only: Claude still opens, exit 0. Both lines print BEFORE the launch.
 *   - "Scanned files" = distinct `file` values in the saved violations, resolved against saved `cwd`.
 *   - "Changed" = mtime strictly later than `scannedAt`, or the file no longer exists.
 *
 * Each test runs `fix` inside its own temp project folder, so file mtimes can be
 * set freely with fs.utimesSync without touching the repo.
 *
 * Usage:
 *   node tests/e2e/fix-freshness.test.js
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT      = path.join(__dirname, '../..');
const CLI       = path.join(ROOT, 'src', 'index.js');
const CRITICAL  = path.join(ROOT, 'tests/fixtures/fail-on-critical.html');   // 1 critical violation
const SCAN_FILE = 'allycat-last-scan.json';

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR   = 60 * MINUTE;
const DAY    = 24 * HOUR;

const WARNING_TAIL = 'changed since this scan. Run `allycat scan` to refresh.';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Fresh temp dirs for one test: `tmp` is ALLYCAT_TMPDIR, `project` is the cwd for fix. */
function makeEnv() {
    const base = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'allycat-fresh-test-')));
    const tmp = path.join(base, 'tmp');
    const project = path.join(base, 'project');
    fs.mkdirSync(tmp);
    fs.mkdirSync(project);
    return { tmp, project };
}

function run(command, args, tmpDir, cwd) {
    const env = { ...process.env, ALLYCAT_TMPDIR: tmpDir, ALLYCAT_NO_LAUNCH: '1', NO_COLOR: '1' };
    // Safety net: strip PATH for `fix` so no real terminal can ever open
    if (command === 'fix') {
        delete env.Path;
        env.PATH = path.dirname(process.execPath);
    }
    const result = spawnSync(process.execPath, [CLI, command, ...args], { encoding: 'utf8', cwd, env });
    return { status: result.status, output: (result.stdout || '') + (result.stderr || '') };
}

function writeSaved(tmpDir, data) {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    fs.writeFileSync(path.join(tmpDir, SCAN_FILE), content, 'utf8');
}

/** Create a file in the project with a given mtime (Date). */
function makeFile(project, name, mtime) {
    const full = path.join(project, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, '<img src="x.png">', 'utf8');
    fs.utimesSync(full, mtime, mtime);
    return full;
}

function violation(file, line = 1) {
    return { file, line, rule: 'image-alt', impact: 'critical', description: 'Images need alt text' };
}

/** A timestamp N ms before now, rounded to a whole second (keeps mtime comparisons exact). */
function ago(ms) {
    return new Date(Math.floor((Date.now() - ms) / SECOND) * SECOND);
}

/** Index of the launch line printed under ALLYCAT_NO_LAUNCH, or -1. */
function launchIndex(output) {
    return output.indexOf('claude "');
}

function launchedClaude(output) {
    return launchIndex(output) !== -1 && output.includes(SCAN_FILE);
}

/**
 * Standard setup: a saved scan `scannedAgo` ms old, with one violation per file spec.
 * fileSpecs: [{ name, state: 'unchanged' | 'changed' | 'deleted', violations?: number }]
 */
function setup({ scannedAgo = 2 * HOUR, fileSpecs }) {
    const { tmp, project } = makeEnv();
    const scannedAt = ago(scannedAgo);
    const violations = [];

    for (const { name, state, violations: count = 1 } of fileSpecs) {
        if (state === 'unchanged') makeFile(project, name, new Date(scannedAt.getTime() - HOUR));
        if (state === 'changed')   makeFile(project, name, new Date(scannedAt.getTime() + MINUTE));
        // 'deleted': never created
        for (let i = 0; i < count; i++) violations.push(violation(name, i + 1));
    }

    writeSaved(tmp, { scannedAt: scannedAt.toISOString(), cwd: project, violations });
    return { tmp, project, scannedAt };
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

function assertContains(label, output, substring) {
    assert(label, output.includes(substring), `expected output to contain: "${substring}"`);
}

function assertNotContains(label, output, substring) {
    assert(label, !output.includes(substring), `expected output NOT to contain: "${substring}"`);
}

/** Run fix with a scan of the given age and assert the exact age wording. */
function checkAge(label, scannedAgo, expectedAge) {
    const { tmp, project } = setup({ scannedAgo, fileSpecs: [{ name: 'a.html', state: 'unchanged' }] });
    const { output } = run('fix', [], tmp, project);
    assertContains(`${label} → "${expectedAge}"`, output, `Using scan from ${expectedAge} (1 violation)`);
}

// =============================================================================
// Acceptance criteria
// =============================================================================

console.log('\n-- AC1: fresh scan, no warning -----------------------------------');
{
    const fileSpecs = ['a.html', 'b.html', 'c.html', 'd.html', 'e.html'].map(name => ({ name, state: 'unchanged' }));
    const { tmp, project } = setup({ scannedAgo: 2 * HOUR, fileSpecs });
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 0', status, 0);
    assertContains('prints the age line', output, 'Using scan from 2 hours ago (5 violations)');
    assertNotContains('no ⚠ line', output, '⚠');
    assertNotContains('no "changed since this scan" text', output, 'changed since this scan');
    assert('Claude still opens', launchedClaude(output));
}

console.log('\n-- AC2: files changed since the scan -----------------------------');
{
    const { tmp, project } = setup({
        scannedAgo: 2 * HOUR,
        fileSpecs: [
            { name: 'a.html', state: 'changed' },
            { name: 'src/b.html', state: 'changed' },
            { name: 'c.html', state: 'unchanged' },
            { name: 'd.html', state: 'unchanged' },
            { name: 'e.html', state: 'unchanged' },
        ],
    });
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 0 (warn only, never blocks)', status, 0);
    assertContains('prints the age line', output, 'Using scan from 2 hours ago (5 violations)');
    assertContains('prints the warning with the changed count', output, `⚠ 2 files ${WARNING_TAIL}`);
    assert('Claude still opens', launchedClaude(output));
}

console.log('\n-- AC2: output order — age, then warning, then launch -------------');
{
    const { tmp, project } = setup({
        fileSpecs: [{ name: 'a.html', state: 'changed' }, { name: 'b.html', state: 'changed' }],
    });
    const { output } = run('fix', [], tmp, project);

    const ageAt = output.indexOf('Using scan from');
    const warnAt = output.indexOf('⚠');
    const launchAt = launchIndex(output);

    assert('age line is printed before the warning', ageAt !== -1 && warnAt !== -1 && ageAt < warnAt,
        `age at ${ageAt}, warning at ${warnAt}`);
    assert('warning is printed before Claude is launched', warnAt !== -1 && launchAt !== -1 && warnAt < launchAt,
        `warning at ${warnAt}, launch at ${launchAt}`);
}

console.log('\n-- AC1: output order — age line before launch (no warning) -------');
{
    const { tmp, project } = setup({ fileSpecs: [{ name: 'a.html', state: 'unchanged' }] });
    const { output } = run('fix', [], tmp, project);

    const ageAt = output.indexOf('Using scan from');
    const launchAt = launchIndex(output);
    assert('age line is printed before Claude is launched', ageAt !== -1 && launchAt !== -1 && ageAt < launchAt,
        `age at ${ageAt}, launch at ${launchAt}`);
}

console.log('\n-- AC3: count distinct files, not violations ----------------------');
{
    const { tmp, project } = setup({
        fileSpecs: [
            { name: 'a.html', state: 'changed', violations: 3 },
            { name: 'b.html', state: 'unchanged', violations: 2 },
        ],
    });
    const { output } = run('fix', [], tmp, project);

    assertContains('age line counts all violations', output, '(5 violations)');
    assertContains('warning says "1 file" (singular)', output, `⚠ 1 file ${WARNING_TAIL}`);
    assertNotContains('never "1 files"', output, '1 files');
}

console.log('\n-- AC4: deleted file counts as changed ----------------------------');
{
    const { tmp, project } = setup({
        fileSpecs: [
            { name: 'gone.html', state: 'deleted' },
            { name: 'a.html', state: 'unchanged' },
        ],
    });
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 0 (no crash)', status, 0);
    assertContains('deleted file is counted', output, `⚠ 1 file ${WARNING_TAIL}`);
    assertNotContains('no stack trace', output, '    at ');
    assert('Claude still opens', launchedClaude(output));
}

console.log('\n-- Paths: absolute file paths in the saved scan also work ---------');
{
    const { tmp, project } = makeEnv();
    const scannedAt = ago(2 * HOUR);
    const changed = makeFile(project, 'abs.html', new Date(scannedAt.getTime() + MINUTE));
    writeSaved(tmp, { scannedAt: scannedAt.toISOString(), cwd: project, violations: [violation(changed)] });
    const { output } = run('fix', [], tmp, project);

    assertContains('changed file found via absolute path', output, `⚠ 1 file ${WARNING_TAIL}`);
}

console.log('\n-- AC5: age wording -----------------------------------------------');
{
    checkAge('30 seconds', 30 * SECOND, 'just now');
    checkAge('scannedAt in the future (clock skew)', -5 * MINUTE, 'just now');
    checkAge('1 minute', 1 * MINUTE + 5 * SECOND, '1 minute ago');
    checkAge('59 minutes', 59 * MINUTE + 5 * SECOND, '59 minutes ago');
    checkAge('1 hour', 1 * HOUR + 5 * SECOND, '1 hour ago');
    checkAge('90 minutes rounds down', 90 * MINUTE, '1 hour ago');
    checkAge('23h 59m', 23 * HOUR + 59 * MINUTE, '23 hours ago');
    checkAge('1 day', 1 * DAY + 5 * SECOND, '1 day ago');
    checkAge('3 days', 3 * DAY + 5 * SECOND, '3 days ago');
}

console.log('\n-- AC5: violation count pluralization -----------------------------');
{
    const { tmp, project } = setup({ fileSpecs: [{ name: 'a.html', state: 'unchanged' }] });
    const { output } = run('fix', [], tmp, project);
    assertContains('"(1 violation)" singular', output, 'Using scan from 2 hours ago (1 violation)');
}

console.log('\n-- End to end: real scan → fix → edit → fix -----------------------');
{
    const { tmp, project } = makeEnv();
    const page = path.join(project, 'page.html');
    fs.copyFileSync(CRITICAL, page);
    // Make sure the file's mtime is before the scan
    const before = ago(HOUR);
    fs.utimesSync(page, before, before);

    run('scan', ['page.html'], tmp, project);

    const first = run('fix', [], tmp, project);
    assertContains('right after scanning: "just now"', first.output, 'Using scan from just now');
    assertNotContains('right after scanning: no warning', first.output, '⚠');

    const later = new Date(Date.now() + MINUTE);
    fs.utimesSync(page, later, later);

    const second = run('fix', [], tmp, project);
    assertContains('after editing: warning appears', second.output, `⚠ 1 file ${WARNING_TAIL}`);
    assertExit('after editing: exit 0', second.status, 0);
    assert('after editing: Claude still opens', launchedClaude(second.output));
}

// =============================================================================
// Error and edge cases
// =============================================================================

console.log('\n-- E1: no saved scan — unchanged, no age line ---------------------');
{
    const { tmp, project } = makeEnv();
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 1 (as before)', status, 1);
    assertContains('existing message', output, 'No scan found');
    assertNotContains('no age line', output, 'Using scan from');
}

console.log('\n-- E1: unreadable saved scan — unchanged, no age line -------------');
{
    const { tmp, project } = makeEnv();
    writeSaved(tmp, '{ this is not json');
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 1 (as before)', status, 1);
    assertContains('existing message', output, 'could not be read');
    assertNotContains('no age line', output, 'Using scan from');
}

console.log('\n-- E1: different folder — unchanged, no age line ------------------');
{
    const { tmp, project } = makeEnv();
    const other = makeEnv().project;
    writeSaved(tmp, { scannedAt: ago(2 * HOUR).toISOString(), cwd: other, violations: [violation('a.html')] });
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 1 (as before)', status, 1);
    assertContains('existing message', output, 'not this folder');
    assertNotContains('no age line', output, 'Using scan from');
}

console.log('\n-- E2: zero violations — unchanged, no age line, no file check ----');
{
    const { tmp, project } = makeEnv();
    writeSaved(tmp, { scannedAt: ago(2 * HOUR).toISOString(), cwd: project, violations: [] });
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 0', status, 0);
    assertContains('existing message', output, 'Nothing to fix');
    assertNotContains('no age line', output, 'Using scan from');
    assertNotContains('no warning', output, '⚠');
}

console.log('\n-- E3: scannedAt missing — "unknown time", skip check, still opens -');
{
    const { tmp, project } = makeEnv();
    makeFile(project, 'a.html', new Date());   // would count as changed if checked
    writeSaved(tmp, { cwd: project, violations: [violation('a.html'), violation('a.html', 2)] });
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 0 (not blocked)', status, 0);
    assertContains('unknown-time age line', output, 'Using scan from an unknown time (2 violations)');
    assertNotContains('file check skipped — no warning', output, '⚠');
    assert('Claude still opens', launchedClaude(output));
}

console.log('\n-- E3: scannedAt not a valid date — same as missing ---------------');
{
    const { tmp, project } = makeEnv();
    makeFile(project, 'a.html', new Date());
    writeSaved(tmp, { scannedAt: 'not-a-date', cwd: project, violations: [violation('a.html')] });
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 0 (not blocked)', status, 0);
    assertContains('unknown-time age line', output, 'Using scan from an unknown time (1 violation)');
    assertNotContains('file check skipped — no warning', output, '⚠');
    assert('Claude still opens', launchedClaude(output));
}

console.log('\n-- E4: stat fails (not "not found") — file skipped, no crash -------');
{
    // A NUL byte in the path makes fs.stat throw a non-ENOENT error on every platform
    const { tmp, project } = setup({
        fileSpecs: [
            { name: 'bad\u0000name.html', state: 'deleted' },
            { name: 'a.html', state: 'unchanged' },
        ],
    });
    const { status, output } = run('fix', [], tmp, project);

    assertExit('exit 0 (no crash)', status, 0);
    assertContains('age line still printed', output, 'Using scan from 2 hours ago (2 violations)');
    assertNotContains('unreadable file is not counted', output, '⚠');
    assertNotContains('no stack trace', output, '    at ');
    assert('Claude still opens', launchedClaude(output));
}

console.log('\n-- E5: mtime exactly equal to scannedAt — not changed --------------');
{
    const { tmp, project } = makeEnv();
    const scannedAt = ago(2 * HOUR);
    makeFile(project, 'a.html', scannedAt);
    writeSaved(tmp, { scannedAt: scannedAt.toISOString(), cwd: project, violations: [violation('a.html')] });
    const { output } = run('fix', [], tmp, project);

    assertContains('age line printed', output, 'Using scan from 2 hours ago (1 violation)');
    assertNotContains('equal mtime is not "changed"', output, '⚠');
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
