/**
 * fix-claude-check.test.js
 *
 * End-to-end tests for the `allycat fix` "Claude Code installed?" check.
 * Written from the approved spec BEFORE the implementation (test-first).
 *
 * Spec summary:
 *   - `fix` looks for a `claude` executable in the PATH folders (no `where`/`which`).
 *     Windows: `claude` + any PATHEXT extension. Elsewhere: an executable file named `claude`.
 *   - Missing → prints "Claude Code is not installed. Install it from <link>, then run
 *     `allycat fix` again.", exits 1, launches nothing, prints no freshness/"Handing" lines.
 *   - The check runs AFTER the scan checks (missing / invalid / wrong folder / nothing to fix)
 *     and BEFORE the freshness line. It also runs under ALLYCAT_NO_LAUNCH=1.
 *
 * Each test controls PATH completely: only the folders the test builds are on it.
 * Fake `claude` files are never executed (ALLYCAT_NO_LAUNCH=1).
 *
 * Not automated: E2 "folder that can't be read" — not portable to set up; verify manually.
 * Windows: E1 "PATH unset" checks isCommandOnPath directly — Node always re-adds PATH to child processes there.
 *
 * Usage:
 *   node tests/e2e/fix-claude-check.test.js
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { makeFakeClaudeDir, withoutPath } from './helpers/fakeClaude.js';
import { isCommandOnPath } from '../../src/utils/commandOnPath.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT        = path.join(__dirname, '../..');
const CLI         = path.join(ROOT, 'src', 'index.js');
const CRITICAL    = 'tests/fixtures/fail-on-critical.html';
const SCAN_FILE   = 'allycat-last-scan.json';
const INSTALL_URL = 'https://code.claude.com/docs/en/quickstart#step-1-install-claude-code';
const NOT_INSTALLED = 'Claude Code is not installed';
const IS_WINDOWS  = process.platform === 'win32';

const SAMPLE_VIOLATION = {
    file: CRITICAL,
    line: 11,
    rule: 'image-alt',
    impact: 'critical',
    description: 'Ensure <img> elements have alternative text',
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeTmpDir(prefix = 'allycat-claude-check-') {
    return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Empty folder: putting only this on PATH means "Claude not installed". */
function makeEmptyBinDir() {
    return makeTmpDir('allycat-empty-bin-');
}

/** Valid saved scan for this repo with `count` violations. */
function writeValidScan(tmpDir, count = 1) {
    const violations = Array.from({ length: count }, (_, i) => ({ ...SAMPLE_VIOLATION, line: 11 + i }));
    writeSaved(tmpDir, { scannedAt: new Date().toISOString(), cwd: ROOT, violations });
}

function writeSaved(tmpDir, data) {
    const content = typeof data === 'string' ? data : JSON.stringify(data);
    fs.writeFileSync(path.join(tmpDir, SCAN_FILE), content, 'utf8');
}

/**
 * Run `allycat fix` with full control of PATH.
 *
 * @param {string} tmpDir - ALLYCAT_TMPDIR
 * @param {string|undefined} pathValue - Exact PATH value; undefined = PATH unset
 */
function runFix(tmpDir, pathValue) {
    const env = { ...withoutPath(process.env), ALLYCAT_TMPDIR: tmpDir, ALLYCAT_NO_LAUNCH: '1', NO_COLOR: '1' };
    if (pathValue !== undefined) env.PATH = pathValue;
    const result = spawnSync(process.execPath, [CLI, 'fix'], { encoding: 'utf8', cwd: ROOT, env });
    return { status: result.status, output: (result.stdout || '') + (result.stderr || '') };
}

const joinPath = (...dirs) => dirs.join(path.delimiter);

/** True when `fix` launched (or, under ALLYCAT_NO_LAUNCH, would launch) claude. */
function launchedClaude(output) {
    return /\bclaude\b/.test(output) && output.includes(SCAN_FILE);
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

/** Every "Claude counts as installed" case checks the same things (AC1). */
function expectInstalled({ status, output }) {
    assertExit('exit 0', status, 0);
    assert('launches claude', launchedClaude(output));
    assertNotContains('no "not installed" message', output, NOT_INSTALLED);
}

/** Every "Claude counts as missing" case checks the same things (AC2). */
function expectMissing({ status, output }) {
    assertExit('exit 1', status, 1);
    assertContains('says Claude Code is not installed', output, NOT_INSTALLED);
    assertContains('shows the install link', output, INSTALL_URL);
    assert('tells the user to run allycat fix again', /run `?allycat fix`? again/i.test(output),
        'expected output to match: /run `?allycat fix`? again/i');
    assert('no terminal launched', !launchedClaude(output));
    assertNotContains('no "Handing" line', output, 'Handing');
    assertNotContains('no freshness line', output, 'Using scan from');
    assertNotContains('no stack trace', output, '    at ');
}

// =============================================================================
// Acceptance criteria
// =============================================================================

console.log('\n-- AC1: Claude installed → launches as before ---------------------');
{
    const tmp = makeTmpDir();
    writeValidScan(tmp, 2);
    const result = runFix(tmp, makeFakeClaudeDir());

    expectInstalled(result);
    assertContains('freshness line still printed', result.output, 'Using scan from');
    assertContains('"Handing" line still printed', result.output, 'Handing 2 violations');
}

console.log('\n-- AC2: Claude not installed → message, exit 1, no launch --------');
{
    const tmp = makeTmpDir();
    writeValidScan(tmp);
    expectMissing(runFix(tmp, makeEmptyBinDir()));
}

console.log('\n-- AC3: saved scan untouched when Claude is missing ---------------');
{
    const tmp = makeTmpDir();
    writeValidScan(tmp);
    const before = fs.readFileSync(path.join(tmp, SCAN_FILE));
    runFix(tmp, makeEmptyBinDir());
    const after = fs.readFileSync(path.join(tmp, SCAN_FILE));

    assert('saved scan is byte-for-byte the same', before.equals(after));
}

console.log('\n-- AC4: scan errors win over the Claude check ---------------------');
{
    const cases = [
        ['no saved scan',      () => {},                                         'No scan found'],
        ['invalid saved scan', (tmp) => writeSaved(tmp, '{ this is not json'),   'could not be read'],
        ['scan from another folder', (tmp) => writeSaved(tmp, {
            scannedAt: new Date().toISOString(),
            cwd: path.join(os.tmpdir(), 'some-other-project'),
            violations: [SAMPLE_VIOLATION],
        }), 'here first'],
    ];

    for (const [name, setup, expected] of cases) {
        const tmp = makeTmpDir();
        setup(tmp);
        const { status, output } = runFix(tmp, makeEmptyBinDir());

        assertExit(`${name}: exit 1`, status, 1);
        assertContains(`${name}: shows the scan message`, output, expected);
        assertNotContains(`${name}: no "not installed" message`, output, NOT_INSTALLED);
    }
}

console.log('\n-- AC5: nothing to fix does not need Claude -----------------------');
{
    const tmp = makeTmpDir();
    writeSaved(tmp, { scannedAt: new Date().toISOString(), cwd: ROOT, violations: [] });
    const { status, output } = runFix(tmp, makeEmptyBinDir());

    assertExit('exit 0', status, 0);
    assert('prints "Nothing to fix"', /nothing to fix/i.test(output));
    assertNotContains('no "not installed" message', output, NOT_INSTALLED);
}

if (IS_WINDOWS) {
    console.log('\n-- AC6 (Windows): claude.cmd only → installed ---------------------');
    {
        const tmp = makeTmpDir();
        writeValidScan(tmp);
        expectInstalled(runFix(tmp, makeFakeClaudeDir()));   // helper writes claude.cmd on Windows
    }

    console.log('\n-- AC6 (Windows): claude.exe only → installed ---------------------');
    {
        const tmp = makeTmpDir();
        const bin = makeEmptyBinDir();
        fs.writeFileSync(path.join(bin, 'claude.exe'), '');
        writeValidScan(tmp);
        expectInstalled(runFix(tmp, bin));
    }

    console.log('\n-- AC6 (Windows): bare `claude` with no extension → missing ------');
    {
        const tmp = makeTmpDir();
        const bin = makeEmptyBinDir();
        fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\n');
        writeValidScan(tmp);
        expectMissing(runFix(tmp, bin));
    }
}

// =============================================================================
// Error and edge cases
// =============================================================================

console.log('\n-- E1: PATH empty → missing, no crash -----------------------------');
{
    const tmp = makeTmpDir();
    writeValidScan(tmp);
    expectMissing(runFix(tmp, ''));
}

if (!IS_WINDOWS) {
    console.log('\n-- E1 (POSIX): PATH unset → missing, no crash ----------------------');
    {
        const tmp = makeTmpDir();
        writeValidScan(tmp);
        expectMissing(runFix(tmp, undefined));
    }
} else {
    // On Windows, Node (libuv) copies the parent's PATH into any child spawned
    // without one, so "PATH unset" can't be set up end to end. Check the lookup directly.
    console.log('\n-- E1 (Windows): PATH unset → not found, no crash ----------------');
    {
        let found;
        try { found = isCommandOnPath('claude', {}); } catch { found = 'threw'; }
        assert('isCommandOnPath with no PATH returns false', found === false, `got: ${found}`);
    }
}

console.log('\n-- E2: bad PATH entries are skipped, later claude still found -----');
{
    const tmp = makeTmpDir();
    const missingDir = path.join(os.tmpdir(), 'allycat-no-such-folder-' + Date.now());
    writeValidScan(tmp);
    expectInstalled(runFix(tmp, joinPath(missingDir, '', makeFakeClaudeDir())));
}

console.log('\n-- E3: a folder named claude does not count -----------------------');
{
    const tmp = makeTmpDir();
    const bin = makeEmptyBinDir();
    fs.mkdirSync(path.join(bin, 'claude'));
    if (IS_WINDOWS) fs.mkdirSync(path.join(bin, 'claude.cmd'));
    writeValidScan(tmp);
    expectMissing(runFix(tmp, bin));
}

if (!IS_WINDOWS) {
    console.log('\n-- E4 (POSIX): claude without execute permission → missing -------');
    {
        const tmp = makeTmpDir();
        const bin = makeEmptyBinDir();
        fs.writeFileSync(path.join(bin, 'claude'), '#!/bin/sh\nexit 0\n', { mode: 0o644 });
        writeValidScan(tmp);
        expectMissing(runFix(tmp, bin));
    }
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
