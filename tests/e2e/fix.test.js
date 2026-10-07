/**
 * fix.test.js
 *
 * End-to-end tests for Stage 2 of `allycat fix`: real scan data handed to Claude.
 * Written from the approved spec BEFORE the implementation (test-first).
 *
 * Spec summary:
 *   - `allycat scan` saves { scannedAt, cwd, violations } to <tmp>/allycat-last-scan.json
 *   - `allycat fix` reads that file and launches `claude` pointed at it — never scans
 *
 * Test hooks (from the spec):
 *   ALLYCAT_TMPDIR    — overrides the OS temp folder, so tests never touch the real one
 *   ALLYCAT_NO_LAUNCH — `fix` prints the command it would run instead of opening a terminal
 *
 * Not automated: E4 (terminal/claude launch fallback) — needs a real terminal; verify manually.
 *
 * Usage:
 *   node tests/e2e/fix.test.js
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT      = path.join(__dirname, '../..');
const CLI       = path.join(ROOT, 'src', 'index.js');
const CRITICAL  = 'tests/fixtures/fail-on-critical.html';   // 1 critical violation
const CLEAN     = 'tests/fixtures/fail-on-clean.html';      // 0 violations
const SCAN_FILE = 'allycat-last-scan.json';

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/** Fresh, isolated temp folder used as ALLYCAT_TMPDIR for one test. */
function makeTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'allycat-fix-test-'));
}

function run(command, args, tmpDir, cwd = ROOT) {
    const env = { ...process.env, ALLYCAT_TMPDIR: tmpDir, ALLYCAT_NO_LAUNCH: '1', NO_COLOR: '1' };
    // Safety net: strip PATH for `fix` so no real terminal can ever open,
    // even if ALLYCAT_NO_LAUNCH is ignored (e.g. before it's implemented).
    if (command === 'fix') {
        delete env.Path;
        env.PATH = path.dirname(process.execPath);
    }
    const result = spawnSync(process.execPath, [CLI, command, ...args], { encoding: 'utf8', cwd, env });
    return { status: result.status, output: (result.stdout || '') + (result.stderr || '') };
}

function readSaved(tmpDir) {
    return JSON.parse(fs.readFileSync(path.join(tmpDir, SCAN_FILE), 'utf8'));
}

function writeSaved(tmpDir, data) {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    fs.writeFileSync(path.join(tmpDir, SCAN_FILE), content, 'utf8');
}

/** Identity of a violation, independent of formatting extras. */
function key(v) {
    return `${v.file}|${v.rule ?? v.ruleId}|${v.line}|${v.impact}`;
}

const SAMPLE_VIOLATION = {
    file: CRITICAL,
    line: 11,
    rule: 'image-alt',
    impact: 'critical',
    description: 'Ensure <img> elements have alternative text',
};

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

function assertNonZero(label, actual) {
    assert(label, actual !== 0 && actual !== null, `expected non-zero exit, got ${actual}`);
}

function assertContains(label, output, substring) {
    assert(label, output.includes(substring), `expected output to contain: "${substring}"`);
}

function assertMatches(label, output, regex) {
    assert(label, regex.test(output), `expected output to match: ${regex}`);
}

function assertNotContains(label, output, substring) {
    assert(label, !output.includes(substring), `expected output NOT to contain: "${substring}"`);
}

/** True when `fix` launched (or, under ALLYCAT_NO_LAUNCH, would launch) claude. */
function launchedClaude(output) {
    return /\bclaude\b/.test(output) && output.includes(SCAN_FILE);
}

function safeReadSaved(tmpDir) {
    try { return readSaved(tmpDir); } catch { return null; }
}

// =============================================================================
// Part A — `allycat scan` saves the data
// =============================================================================

console.log('\n-- A1: scan with violations saves them --------------------------');
{
    const tmp = makeTmpDir();
    const reportPath = path.join(tmp, 'report.json');
    run('scan', [CRITICAL, '-j', reportPath], tmp);

    const saved = safeReadSaved(tmp);
    assert('allycat-last-scan.json exists in the temp folder', saved !== null);

    const printed = JSON.parse(fs.readFileSync(reportPath, 'utf8')).violations;
    const savedViolations = saved?.violations ?? [];
    assert('saved violation count matches the scan', savedViolations.length === printed.length,
        `expected ${printed.length}, got ${savedViolations.length}`);
    assert('saved violations match the scan (file/rule/line/impact)',
        JSON.stringify(savedViolations.map(key).sort()) === JSON.stringify(printed.map(key).sort()));
    assert('cwd is the folder the scan ran in',
        saved?.cwd && path.resolve(saved.cwd).toLowerCase() === path.resolve(ROOT).toLowerCase(),
        `got cwd: ${saved?.cwd}`);
    assert('scannedAt is a valid timestamp', saved && !Number.isNaN(Date.parse(saved.scannedAt)));
}

console.log('\n-- A2: clean scan saves an empty list ---------------------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, { scannedAt: new Date().toISOString(), cwd: ROOT, violations: [SAMPLE_VIOLATION] });
    run('scan', [CLEAN], tmp);

    const saved = safeReadSaved(tmp);
    assert('file is written with violations: []',
        Array.isArray(saved?.violations) && saved.violations.length === 0,
        `got: ${JSON.stringify(saved?.violations)}`);
}

console.log('\n-- A3: a newer scan replaces the old one -------------------------');
{
    const tmp = makeTmpDir();
    run('scan', [CRITICAL], tmp);
    const first = safeReadSaved(tmp);
    run('scan', [CLEAN], tmp);
    const second = safeReadSaved(tmp);

    assert('first scan saved 1+ violations', (first?.violations?.length ?? 0) > 0);
    assert('second scan replaced it with only its own data (0 violations)',
        second?.violations?.length === 0, `got ${second?.violations?.length}`);
}

console.log('\n-- A4: scans that exit non-zero still save -----------------------');
{
    const tmp = makeTmpDir();
    const { status } = run('scan', [CRITICAL, '--fail-on-critical'], tmp);
    assertExit('threshold hit → exit 1', status, 1);
    assert('file was still written', (safeReadSaved(tmp)?.violations?.length ?? 0) > 0);
}

console.log('\n-- A5: the project stays untouched -------------------------------');
{
    const tmp = makeTmpDir();
    const before = new Set(fs.readdirSync(ROOT));
    run('scan', [CRITICAL], tmp);
    const added = fs.readdirSync(ROOT).filter(f => !before.has(f));

    assert('no new file in the project folder', added.length === 0, `new files: ${added.join(', ')}`);
    assert('saved file is not in the project folder', !fs.existsSync(path.join(ROOT, SCAN_FILE)));
}

console.log('\n-- A6: a failed scan keeps the old file --------------------------');
{
    const tmp = makeTmpDir();
    const original = { scannedAt: '2026-01-01T00:00:00.000Z', cwd: ROOT, violations: [SAMPLE_VIOLATION] };
    writeSaved(tmp, original);
    run('scan', ['tests/fixtures/does-not-exist.html'], tmp);

    const after = fs.readFileSync(path.join(tmp, SCAN_FILE), 'utf8');
    assert('previous file left exactly as it was', after === JSON.stringify(original));
}

// =============================================================================
// Part B — `allycat fix` uses the data
// =============================================================================

console.log('\n-- B1: happy path ------------------------------------------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, { scannedAt: new Date().toISOString(), cwd: ROOT, violations: [SAMPLE_VIOLATION, { ...SAMPLE_VIOLATION, line: 20 }] });
    const { status, output } = run('fix', [], tmp);

    assertExit('exit 0', status, 0);
    assert('launches claude pointing at the saved scan file', launchedClaude(output));
    assertContains('prompt includes the full saved file path', output, path.join(tmp, SCAN_FILE));
    assertMatches('prompt tells Claude to read the file', output, /read/i);
    assertMatches('prompt asks for targeted fixes', output, /targeted/i);
    assertMatches('console shows how many violations are handed over', output, /\b2 violations?\b/i);
}

console.log('\n-- B1+: end to end (real scan → fix) -----------------------------');
{
    const tmp = makeTmpDir();
    run('scan', [CRITICAL], tmp);
    const { status, output } = run('fix', [], tmp);

    assertExit('exit 0', status, 0);
    assert('launches claude pointing at the saved scan file', launchedClaude(output));
}

console.log('\n-- B2: no dummy data ---------------------------------------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, { scannedAt: new Date().toISOString(), cwd: ROOT, violations: [SAMPLE_VIOLATION] });
    const { output } = run('fix', [], tmp);
    const dummyFiles = fs.readdirSync(tmp).filter(f => /^allycat-fix-.*\.md$/.test(f));

    assertNotContains('hardcoded dummy violation is gone', output, 'Button.tsx');
    assert('no allycat-fix-<ts>.md example file created', dummyFiles.length === 0,
        `found: ${dummyFiles.join(', ')}`);
}

console.log('\n-- B3: fix never scans -------------------------------------------');
{
    const tmp = makeTmpDir();
    const original = { scannedAt: '2026-01-01T00:00:00.000Z', cwd: ROOT, violations: [SAMPLE_VIOLATION] };
    writeSaved(tmp, original);
    const { output } = run('fix', [], tmp);

    assertNotContains('no scan banner printed', output, 'AllyCat Scan');
    assert('saved scan file not rewritten by fix',
        fs.readFileSync(path.join(tmp, SCAN_FILE), 'utf8') === JSON.stringify(original));
}

// =============================================================================
// Error cases (`fix`)
// =============================================================================

console.log('\n-- E1: no saved scan ---------------------------------------------');
{
    const tmp = makeTmpDir();
    const { status, output } = run('fix', [], tmp);

    assertNonZero('non-zero exit', status);
    assertContains('tells the user no scan was found', output, 'No scan found');
    assertContains('tells the user to run allycat scan', output, 'allycat scan');
    assert('no terminal launched', !launchedClaude(output));
}

console.log('\n-- E2: corrupted file --------------------------------------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, '{ this is not json');
    const { status, output } = run('fix', [], tmp);

    assertNonZero('non-zero exit', status);
    assertContains('tells the user to re-run allycat scan', output, 'allycat scan');
    assertNotContains('no stack trace', output, '    at ');
    assert('no terminal launched', !launchedClaude(output));
}

console.log('\n-- E3: last scan was clean ---------------------------------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, { scannedAt: new Date().toISOString(), cwd: ROOT, violations: [] });
    const { status, output } = run('fix', [], tmp);

    assertExit('exit 0', status, 0);
    assertMatches('prints "Nothing to fix"', output, /nothing to fix/i);
    assert('no terminal launched', !launchedClaude(output));
}

console.log('\n-- E5: scan came from a different project ------------------------');
{
    const tmp = makeTmpDir();
    const otherProject = path.join(os.tmpdir(), 'some-other-project');
    writeSaved(tmp, { scannedAt: new Date().toISOString(), cwd: otherProject, violations: [SAMPLE_VIOLATION] });
    const { status, output } = run('fix', [], tmp);

    assertNonZero('non-zero exit', status);
    assertContains('names the folder the scan came from', output, otherProject);
    assertMatches('tells the user to scan here first', output, /run `?allycat scan`? here first/i);
    assert('no terminal launched', !launchedClaude(output));
}

if (process.platform === 'win32') {
    console.log('\n-- E5 (Windows): same folder, different case/slashes is a match ---');
    const tmp = makeTmpDir();
    const sameFolder = path.resolve(ROOT).toUpperCase().replace(/\\/g, '/');
    writeSaved(tmp, { scannedAt: new Date().toISOString(), cwd: sameFolder, violations: [SAMPLE_VIOLATION] });
    const { status, output } = run('fix', [], tmp);

    assertExit('exit 0', status, 0);
    assert('launches claude (treated as the same project)', launchedClaude(output));
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
