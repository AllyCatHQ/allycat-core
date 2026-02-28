/**
 * thresholds.test.js
 *
 * End-to-end tests for --fail-on-critical, --fail-on-serious, --fail-on-any.
 * Spawns the CLI as a child process and checks the exit code.
 *
 * Fixtures:
 *   fail-on-critical.html  — contains a critical violation (missing img alt)
 *   fail-on-clean.html     — fully accessible, no violations
 *
 * Usage:
 *   node tests/e2e/thresholds.test.js
 *
 * Prerequisites:
 *   a11y-config.json must exist in the project root (run "a11y-guard init" first).
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLI      = path.join(__dirname, '../..', 'src', 'index.js');
const CRITICAL = path.join(__dirname, '../fixtures', 'fail-on-critical.html');
const CLEAN    = path.join(__dirname, '../fixtures', 'fail-on-clean.html');

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

function run(args) {
    const result = spawnSync('node', [CLI, 'scan', ...args], {
        encoding: 'utf8',
        cwd: path.join(__dirname, '../..'),   // project root — needed for config lookup
    });
    return result.status;
}

// -----------------------------------------------------------------------------
// Assertions
// -----------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
    const ok = actual === expected;
    const icon = ok ? '✓' : '✗';
    console.log(`  ${icon}  ${label}`);
    if (!ok) {
        console.log(`       expected exit ${expected}, got ${actual}`);
    }
    ok ? passed++ : failed++;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

console.log('\n-- --fail-on-critical ------------------------------------------');
assert('critical file → exit 1', run([CRITICAL, '--fail-on-critical']), 1);
assert('clean file    → exit 0', run([CLEAN,    '--fail-on-critical']), 0);

console.log('\n-- --fail-on-serious -------------------------------------------');
// critical violations satisfy the "serious or worse" threshold → exit 2
assert('critical file → exit 2', run([CRITICAL, '--fail-on-serious']),  2);
assert('clean file    → exit 0', run([CLEAN,    '--fail-on-serious']),  0);

console.log('\n-- --fail-on-any -----------------------------------------------');
// any violation present → exit 3
assert('critical file → exit 3', run([CRITICAL, '--fail-on-any']),      3);
assert('clean file    → exit 0', run([CLEAN,    '--fail-on-any']),      0);

console.log('\n-- no flag (gate disabled) -------------------------------------');
assert('critical file → exit 0', run([CRITICAL]),                       0);
assert('clean file    → exit 0', run([CLEAN]),                          0);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n  ${passed}/${total} passed\n`);
if (failed > 0) process.exit(1);
