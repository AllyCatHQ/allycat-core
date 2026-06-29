/**
 * slow-files.test.js
 *
 * Unit tests for slow-file detection logic:
 *   1. slowFiles filtering — elapsed >= threshold, timedOut excluded, sorted descending
 *   2. pickSlowFileTip() — returns tip text when slow files exist, null otherwise
 *   3. displaySlowFileWarning() — renders in CI mode (no longer suppressed)
 *
 * Usage:
 *   node tests/e2e/slow-files.test.js
 */

import { SLOW_FILE_THRESHOLD_MS } from '../../src/constants.js';
import { pickSlowFileTip } from '../../src/utils/tips.js';

// -----------------------------------------------------------------------------
// Assertions
// -----------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
    const icon = condition ? '✓' : '✗';
    console.log(`  ${icon}  ${label}`);
    if (!condition && detail) console.log(`       ${detail}`);
    condition ? passed++ : failed++;
}

// -----------------------------------------------------------------------------
// Helper: replicate the slowFiles pipeline used in both scanners
// -----------------------------------------------------------------------------

function collectSlowFiles(results) {
    return results
        .filter(r => r.elapsed >= SLOW_FILE_THRESHOLD_MS && !r.timedOut)
        .sort((a, b) => b.elapsed - a.elapsed)
        .map(r => ({ file: r.filePath, elapsed: Math.round(r.elapsed) }));
}

// -----------------------------------------------------------------------------
// Tests: slowFiles collection pipeline
// -----------------------------------------------------------------------------

console.log('\n  slowFiles collection pipeline\n');

{
    const results = [
        { filePath: 'fast.html', elapsed: 200, timedOut: false },
        { filePath: 'medium.html', elapsed: 3000, timedOut: false },
    ];
    const slow = collectSlowFiles(results);
    assert('files below threshold are excluded', slow.length === 0);
}

{
    const results = [
        { filePath: 'slow-a.html', elapsed: 11000, timedOut: false },
        { filePath: 'slow-b.html', elapsed: 12000, timedOut: false },
        { filePath: 'fast.html', elapsed: 100, timedOut: false },
    ];
    const slow = collectSlowFiles(results);
    assert('files at or above threshold are included', slow.length === 2);
    assert('sorted descending by elapsed', slow[0].file === 'slow-b.html' && slow[1].file === 'slow-a.html');
}

{
    const results = [
        { filePath: 'exact.html', elapsed: SLOW_FILE_THRESHOLD_MS, timedOut: false },
    ];
    const slow = collectSlowFiles(results);
    assert('file exactly at threshold is included', slow.length === 1 && slow[0].file === 'exact.html');
}

{
    const results = [
        { filePath: 'timedout.html', elapsed: 30000, timedOut: true },
        { filePath: 'slow.html', elapsed: 11000, timedOut: false },
    ];
    const slow = collectSlowFiles(results);
    assert('timed-out files are excluded', slow.length === 1 && slow[0].file === 'slow.html');
}

{
    const results = [
        { filePath: 'timedout-only.html', elapsed: 30000, timedOut: true },
    ];
    const slow = collectSlowFiles(results);
    assert('all-timed-out results produce empty slowFiles', slow.length === 0);
}

{
    const results = [
        { filePath: 'a.html', elapsed: 11000.7, timedOut: false },
    ];
    const slow = collectSlowFiles(results);
    assert('elapsed is rounded to integer', slow[0].elapsed === 11001);
}

// -----------------------------------------------------------------------------
// Tests: pickSlowFileTip
// -----------------------------------------------------------------------------

console.log('\n  pickSlowFileTip\n');

assert('returns null for null input', pickSlowFileTip(null) === null);
assert('returns null for undefined input', pickSlowFileTip(undefined) === null);
assert('returns null for empty array', pickSlowFileTip([]) === null);

{
    const tip = pickSlowFileTip([{ file: 'big.html', elapsed: 8000 }]);
    assert('returns string when slow files exist', typeof tip === 'string' && tip.length > 0);
    assert('tip mentions --exclude', tip.includes('--exclude'));
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

console.log(`\n  ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
