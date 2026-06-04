/**
 * exclude.test.js
 *
 * End-to-end tests for the --exclude flag.
 * Verifies that excluded paths and glob patterns are omitted from the scan,
 * and that the config panel correctly reflects active exclusions.
 *
 * Fixtures used:
 *   tests/fixtures/  — the only folder with scannable files in this project.
 *   fail-on-critical.html — has a critical violation (missing img alt).
 *
 * Usage:
 *   node tests/e2e/exclude.test.js
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLI          = path.join(__dirname, '../..', 'src', 'index.js');
const FIXTURES     = path.join(__dirname, '../fixtures');       // absolute — for most tests
const RELTEST      = 'tests/fixtures/reltest';                 // relative — for scoping tests (one file: violation.html)
const CRITICAL     = path.join(__dirname, '../fixtures', 'fail-on-critical.html');

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

function run(args) {
    const result = spawnSync('node', [CLI, 'scan', ...args], {
        encoding: 'utf8',
        cwd: path.join(__dirname, '../..'),
    });
    return { status: result.status, output: (result.stdout || '') + (result.stderr || '') };
}

// -----------------------------------------------------------------------------
// Assertions
// -----------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assertExit(label, actual, expected) {
    const ok = actual === expected;
    console.log(`  ${ok ? '✓' : '✗'}  ${label}`);
    if (!ok) console.log(`       expected exit ${expected}, got ${actual}`);
    ok ? passed++ : failed++;
}

function assertContains(label, output, substring) {
    const ok = output.includes(substring);
    console.log(`  ${ok ? '✓' : '✗'}  ${label}`);
    if (!ok) console.log(`       expected output to contain: "${substring}"`);
    ok ? passed++ : failed++;
}

function assertNotContains(label, output, substring) {
    const ok = !output.includes(substring);
    console.log(`  ${ok ? '✓' : '✗'}  ${label}`);
    if (!ok) console.log(`       expected output NOT to contain: "${substring}"`);
    ok ? passed++ : failed++;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

// -- Baseline -----------------------------------------------------------------
// Confirms the fixtures folder has critical violations before we test exclusion.

console.log('\n-- baseline (confirms fixtures have violations) -----------------');
{
    const { status } = run([CRITICAL, '--fail-on-critical']);
    assertExit('critical fixture → exit 1 without --exclude', status, 1);
}

// -- Config panel output ------------------------------------------------------
// Verifies "Excluding:" appears exactly when --exclude is active.

console.log('\n-- config panel output ------------------------------------------');
{
    const { output } = run([FIXTURES, '--exclude', 'tests/fixtures', '--summary']);
    assertContains('--exclude shows "Excluding:" in config panel', output, 'Excluding:');
}
{
    const { output } = run([FIXTURES, '--summary']);
    assertNotContains('no --exclude: "Excluding:" line absent from panel', output, 'Excluding:');
}
{
    const { output } = run([FIXTURES, '--exclude', 'tests/fixtures', '--exclude', 'src/commands', '--summary']);
    assertContains('multiple excludes: both paths shown in panel', output, 'tests/fixtures, src/commands');
}

// -- Exit code: folder-level exclusion ----------------------------------------
// Excluding the entire fixture folder leaves zero files to scan → no violations.

console.log('\n-- folder-level exclusion ---------------------------------------');
{
    const { status } = run([FIXTURES, '--exclude', 'tests/fixtures', '--fail-on-critical']);
    assertExit('exclude entire fixtures folder → exit 0 (no files to scan)', status, 0);
}
{
    const { status } = run([FIXTURES, '--exclude', 'tests/fixtures', '--fail-on-any']);
    assertExit('exclude entire fixtures folder → exit 0 with --fail-on-any', status, 0);
}

// -- Exit code: glob pattern exclusion ----------------------------------------
// Excluding all supported file types via glob → zero files → no violations.

console.log('\n-- glob pattern exclusion ----------------------------------------');
{
    const { status } = run([
        FIXTURES,
        '--exclude', 'tests/fixtures/**/*.html',
        '--exclude', 'tests/fixtures/**/*.jsx',
        '--exclude', 'tests/fixtures/**/*.vue',
        '--exclude', 'tests/fixtures/**/*.ts',
        '--fail-on-critical'
    ]);
    assertExit('glob excludes all file types → exit 0', status, 0);
}
{
    const { output } = run([FIXTURES, '--exclude', 'tests/fixtures/*.html', '--summary']);
    assertContains('glob pattern shown as-is in config panel', output, 'tests/fixtures/*.html');
}

// -- Relative exclude paths (no target prefix needed) -------------------------
// RELTEST contains a single file (violation.html) with a critical violation.
// Excluding it by short name — without repeating the folder prefix — should
// leave zero files to scan → exit 0 even with --fail-on-critical.

console.log('\n-- relative exclude paths (short form) ---------------------------');
{
    // Baseline: the subfolder has a critical violation
    const { status } = run([RELTEST, '--fail-on-critical']);
    assertExit('reltest baseline → exit 1 (violation.html has critical)', status, 1);
}
{
    // Short form: no need to write "tests/fixtures/reltest/violation.html"
    const { status } = run([RELTEST, '--exclude', 'violation.html', '--fail-on-critical']);
    assertExit('short exclude (no prefix) resolves relative to target → exit 0', status, 0);
}
{
    // Full-path form still works — should not double-prefix
    const { status } = run([RELTEST, '--exclude', 'tests/fixtures/reltest/violation.html', '--fail-on-critical']);
    assertExit('full-path exclude still works → exit 0 (no double-prefix)', status, 0);
}

// -- Non-matching exclude does not affect scan --------------------------------
// A pattern that matches nothing should not suppress real violations.

console.log('\n-- non-matching exclude has no effect ----------------------------');
{
    const { status } = run([CRITICAL, '--exclude', 'tests/fixtures/nonexistent*', '--fail-on-critical']);
    assertExit('non-matching glob → violations still detected → exit 1', status, 1);
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n  ${passed}/${total} passed\n`);
if (failed > 0) process.exit(1);
