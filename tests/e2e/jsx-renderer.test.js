/**
 * jsx-renderer.test.js
 *
 * E2E tests for JSX renderer correctness:
 *   1. HTML name collision: PascalCase components must not match native HTML tags
 *   2. Self-closing non-void: custom components must produce closing tags
 *   3. Existing list-structure fixtures (regression guard)
 *
 * Usage:
 *   node tests/e2e/jsx-renderer.test.js
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLI     = path.join(__dirname, '../..', 'src', 'index.js');
const JSX_DIR = path.join(__dirname, '../samples/react/jsx');

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

function run(file) {
    const result = spawnSync('node', [CLI, 'scan', file, '--fail-on-any'], {
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

function assertNotContains(label, output, substring) {
    const ok = !output.includes(substring);
    console.log(`  ${ok ? '✓' : '✗'}  ${label}`);
    if (!ok) console.log(`       output should NOT contain: "${substring}"`);
    ok ? passed++ : failed++;
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

console.log('\n-- HTML name collision (PascalCase ≠ native HTML) ----------------');
{
    const { status, output } = run(path.join(JSX_DIR, 'HtmlNameCollision.jsx'));
    assertExit('<Select>, <Button>, <Input> etc. → exit 0 (no false positives)', status, 0);
    assertNotContains('no select-name violation', output, 'select-name');
}

console.log('\n-- self-closing non-void tags produce closing tags ---------------');
{
    const { status } = run(path.join(JSX_DIR, 'SelfClosingNonVoid.jsx'));
    assertExit('self-closing components in lists → exit 0 (no DOM corruption)', status, 0);
}

console.log('\n-- existing list false-positive guard ----------------------------');
{
    const { status } = run(path.join(JSX_DIR, 'ListFalsePositive.jsx'));
    assertExit('ListFalsePositive.jsx → exit 0', status, 0);
}

console.log('\n-- real list violations still caught -----------------------------');
{
    const { status } = run(path.join(JSX_DIR, 'ListRealViolation.jsx'));
    assertExit('ListRealViolation.jsx → exit 3 (violations found)', status, 3);
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n  ${passed}/${total} passed\n`);
if (failed > 0) process.exit(1);
