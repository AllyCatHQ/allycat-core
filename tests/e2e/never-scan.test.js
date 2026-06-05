/**
 * never-scan.test.js
 *
 * E2E tests verifying that NEVER_SCAN patterns are enforced across all scan paths.
 * A forbidden file (allycat-report.html) with a critical violation must never be
 * scanned — regardless of whether the entry point is a normal scan or --changed.
 *
 * Each scenario first proves the fixture actually has a violation (baseline),
 * then proves the violation is invisible once the forbidden filename is in play.
 *
 * Usage:
 *   node tests/e2e/never-scan.test.js
 */

import { spawnSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '../..', 'src', 'index.js');

// img without alt → critical violation (axe-core: image-alt)
const HTML_WITH_VIOLATION = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Test</title></head>
<body><img src="photo.jpg"></body>
</html>`;

const HTML_CLEAN = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Clean</title></head>
<body><p>No violations here.</p></body>
</html>`;

const CONFIG = JSON.stringify({
    configVersion: 1,
    selectedStandard: 'wcag-aa',
    rules: { rtl: false, level: 'AA' },
    scan: { defaultMode: 'quick' },
    ai: { enabled: false },
    performance: { concurrency: null },
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function run(args, cwd) {
    const result = spawnSync('node', [CLI, 'scan', ...args], {
        encoding: 'utf8',
        cwd: cwd ?? path.join(__dirname, '../..'),
    });
    return { status: result.status, output: (result.stdout || '') + (result.stderr || '') };
}

function git(args, cwd) {
    return spawnSync('git', args, { cwd, encoding: 'utf8' });
}

function makeTmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'allycat-never-scan-'));
}

function writeConfig(dir) {
    fs.writeFileSync(path.join(dir, 'allycat.config.json'), CONFIG);
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
    if (!ok) console.log(`       expected output NOT to contain: "${substring}"`);
    ok ? passed++ : failed++;
}

// -----------------------------------------------------------------------------
// Scenario 1: Normal scan
// A folder containing allycat-report.html with a violation must exit 0 because
// the forbidden file is excluded before the scanner ever sees it.
// -----------------------------------------------------------------------------

console.log('\n-- normal scan: allycat-report.html is excluded -----------------');
{
    const tmpDir = makeTmpDir();
    try {
        writeConfig(tmpDir);
        fs.writeFileSync(path.join(tmpDir, 'allycat-report.html'), HTML_WITH_VIOLATION);
        fs.writeFileSync(path.join(tmpDir, 'clean.html'), HTML_CLEAN);

        // Baseline: scanning the forbidden file directly proves it has violations.
        const baseline = run(
            [path.join(tmpDir, 'allycat-report.html'), '--fail-on-critical'],
            tmpDir
        );
        assertExit('baseline — allycat-report.html has critical violations (exit 1)', baseline.status, 1);

        // Main: scanning the folder must exclude the forbidden file → no violations.
        const { status, output } = run([tmpDir, '--fail-on-critical'], tmpDir);
        assertExit('folder scan skips allycat-report.html → exit 0', status, 0);
        assertNotContains('allycat-report.html not mentioned in output', output, 'allycat-report.html');
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

// -----------------------------------------------------------------------------
// Scenario 2: --changed mode
// When allycat-report.html is the only file in the git diff, --changed must
// filter it out via NEVER_SCAN and find nothing to scan → exit 0.
// -----------------------------------------------------------------------------

console.log('\n-- --changed mode: allycat-report.html in git diff is excluded --');
{
    const tmpDir = makeTmpDir();
    try {
        writeConfig(tmpDir);

        // Set up a fresh git repo so git diff is isolated to this temp dir.
        git(['init'], tmpDir);
        git(['config', 'user.email', 'test@allycat.test'], tmpDir);
        git(['config', 'user.name', 'AllyCat Test'], tmpDir);

        // First commit: clean.html only (HEAD~1 baseline).
        fs.writeFileSync(path.join(tmpDir, 'clean.html'), HTML_CLEAN);
        git(['add', 'clean.html'], tmpDir);
        git(['commit', '-m', 'init'], tmpDir);

        // Second commit: add allycat-report.html → it appears in git diff HEAD~1.
        fs.writeFileSync(path.join(tmpDir, 'allycat-report.html'), HTML_WITH_VIOLATION);
        git(['add', 'allycat-report.html'], tmpDir);
        git(['commit', '-m', 'add report'], tmpDir);

        // Baseline: scanning the forbidden file directly proves it has violations.
        const baseline = run(
            [path.join(tmpDir, 'allycat-report.html'), '--fail-on-critical'],
            tmpDir
        );
        assertExit('baseline — allycat-report.html has critical violations (exit 1)', baseline.status, 1);

        // Main: --changed surfaces allycat-report.html via git diff, but
        // filterNeverScan removes it before the scanner runs → no violations.
        const { status } = run(['--changed', '--fail-on-critical'], tmpDir);
        assertExit('--changed filters allycat-report.html → exit 0', status, 0);
    } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    }
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n  ${passed}/${total} passed\n`);
if (failed > 0) process.exit(1);
