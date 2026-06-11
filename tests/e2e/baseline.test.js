/**
 * baseline.test.js
 *
 * End-to-end tests for --save-baseline / --fail-on-new two-tier matching.
 * Spawns the CLI as a child process and checks the exit code.
 *
 * File path is part of the baseline match key, so each scenario copies the
 * base fixture to a working file, saves a baseline from it, overwrites the
 * working file with the variant's contents, and rescans the same path.
 *
 * The CLI reads/writes allycat-baseline.json in the cwd (project root) —
 * any real baseline file is backed up before the suite and restored after.
 *
 * Usage:
 *   node tests/e2e/baseline.test.js
 *
 * Prerequisites:
 *   allycat.config.json must exist in the project root (run "allycat init" first).
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT     = path.join(__dirname, '../..');
const CLI      = path.join(ROOT, 'src', 'index.js');
const FIXTURES = path.join(__dirname, '../fixtures');
const WORK     = path.join(FIXTURES, 'baseline-work.html');
const BASELINE = path.join(ROOT, 'allycat-baseline.json');

const fixture = name => path.join(FIXTURES, name);

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

function run(args) {
    const result = spawnSync('node', [CLI, 'scan', ...args], {
        encoding: 'utf8',
        cwd: ROOT,   // project root — needed for config + baseline file lookup
    });
    return result.status;
}

/**
 * Save a baseline from `base`, overwrite the same path with `variant`,
 * rescan with --fail-on-new, and return the exit code.
 */
function scenario(base, variant) {
    fs.copyFileSync(fixture(base), WORK);
    run([WORK, '--save-baseline']);
    fs.copyFileSync(fixture(variant), WORK);
    return run([WORK, '--fail-on-new']);
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

// Back up a real baseline file so test runs never destroy it
const backup = fs.existsSync(BASELINE) ? fs.readFileSync(BASELINE) : null;

try {
    console.log('\n-- unchanged + line shifts (tier 1) ----------------------------');
    assert('identical file            → exit 0', scenario('baseline-a.html', 'baseline-a.html'),         0);
    assert('line shift                → exit 0', scenario('baseline-a.html', 'baseline-a-shifted.html'), 0);

    console.log('\n-- insert before (tier 2 — the cascade fix) --------------------');
    // New <div> inserted before the violating elements shifts every
    // :nth-child() below it; unique fingerprints must still match.
    assert('insert element before     → exit 0', scenario('baseline-a.html', 'baseline-a-insert-before.html'), 0);

    console.log('\n-- genuinely new / changed elements ----------------------------');
    assert('element added after       → exit 4', scenario('baseline-a.html', 'baseline-a-extra.html'),   4);
    assert('element touched           → exit 4', scenario('baseline-a.html', 'baseline-a-touched.html'), 4);

    console.log('\n-- substitution loophole stays closed (identical group) --------');
    // 2 identical broken buttons; one fixed + identical one added elsewhere.
    // Counts match (2 = 2) but the group is ambiguous → the new button is NEW.
    assert('fix one + add identical   → exit 4', scenario('baseline-b.html', 'baseline-b-substituted.html'), 4);

    console.log('\n-- fixed violation (stale, silently ignored) -------------------');
    // Uses the <main>-wrapped fixtures: fixing the img changes its HTML, which
    // would legitimately resurface a region violation in the baseline-a pair.
    assert('violation fixed           → exit 0', scenario('baseline-stale.html', 'baseline-stale-fixed.html'), 0);

    console.log('\n-- document-level rules match by (file, rule) ------------------');
    // Page edit changes the <html> outerHTML; html-has-lang must stay BASELINE.
    assert('html-has-lang stable      → exit 0', scenario('baseline-lang.html', 'baseline-lang-edited.html'), 0);
} finally {
    // Cleanup working file + restore any pre-existing baseline
    fs.rmSync(WORK, { force: true });
    if (backup !== null) {
        fs.writeFileSync(BASELINE, backup);
    } else {
        fs.rmSync(BASELINE, { force: true });
    }
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
