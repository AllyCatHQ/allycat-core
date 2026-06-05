/**
 * standards.test.js
 *
 * E2E tests verifying all three accessibility standards complete without error.
 * Each test writes a minimal config to a temp dir, runs a scan, and checks
 * the exit code — proving the axe tag set for each standard resolves correctly.
 *
 * Regression guard for ghost-tag class of bugs: if a tag is invalid, axe-core
 * throws at runtime. These tests catch that before publish.
 *
 * Usage:
 *   node tests/e2e/standards.test.js
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLI   = path.join(__dirname, '../..', 'src', 'index.js');
const CLEAN = path.join(__dirname, '../fixtures', 'fail-on-clean.html');

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

function runWithStandard(standard) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'allycat-standards-'));
    const config = {
        configVersion: 1,
        selectedStandard: standard,
        rules: { rtl: false, level: 'AA' },
        scan: { defaultMode: 'quick' },
        ai: { enabled: false },
        performance: { concurrency: null },
    };
    fs.writeFileSync(path.join(tmpDir, 'allycat.config.json'), JSON.stringify(config));

    const result = spawnSync('node', [CLI, 'scan', CLEAN], {
        encoding: 'utf8',
        cwd: tmpDir,
    });

    fs.rmSync(tmpDir, { recursive: true, force: true });
    return result.status;
}

// -----------------------------------------------------------------------------
// Assertions
// -----------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
    const ok = actual === expected;
    console.log(`  ${ok ? '✓' : '✗'}  ${label}`);
    if (!ok) console.log(`       expected exit ${expected}, got ${actual}`);
    ok ? passed++ : failed++;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

console.log('\n-- standards: clean file should always exit 0 ------------------');
assert('wcag-aa    — completes without error', runWithStandard('wcag-aa'),    0);
assert('wcag-22-aa — completes without error', runWithStandard('wcag-22-aa'), 0);
assert('wcag-aaa   — completes without error', runWithStandard('wcag-aaa'),   0);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n  ${passed}/${total} passed\n`);
if (failed > 0) process.exit(1);
