/**
 * config-loader.test.js
 *
 * Regression tests for loadConfig() hardening:
 *   1. Valid-JSON-but-non-object config files (null, [], "text", 42, true)
 *      must fall back to defaults — not crash, and never overwrite the file.
 *   2. Partial configs (missing selectedStandard / scan / rules / ai) must be
 *      filled from DEFAULT_CONFIG so downstream consumers never crash.
 *   3. A read-only config needing migration must not crash loadConfig.
 *   4. DEFAULT_CONFIG's nested objects must never be mutable through a
 *      returned config.
 *
 * Also spawns the real CLI against a partial config to prove `allycat scan`
 * survives a hand-edited config (regression: scan.js displayScanConfiguration
 * crashed on config.selectedStandard.toUpperCase()).
 *
 * Usage:
 *   node tests/e2e/config-loader.test.js
 */

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig, DEFAULT_CONFIG } from '../../src/utils/configLoader.js';
import { STANDARDS, SCAN_MODES, CONFIG_FILE_NAME } from '../../src/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI = path.join(__dirname, '../..', 'src', 'index.js');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const originalCwd = process.cwd();
const tempDirs = [];

/** Create a temp dir containing a config file with the given raw content. */
function makeConfigDir(content) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allycat-cfg-test-'));
    tempDirs.push(dir);
    if (content !== undefined) {
        fs.writeFileSync(path.join(dir, CONFIG_FILE_NAME), content);
    }
    return dir;
}

/** Run loadConfig() with cwd pointed at the given dir. */
function loadFrom(dir, scanMode = SCAN_MODES.QUICK) {
    process.chdir(dir);
    try {
        return loadConfig(scanMode);
    } finally {
        process.chdir(originalCwd);
    }
}

function cleanup() {
    for (const dir of tempDirs) {
        try {
            const cfg = path.join(dir, CONFIG_FILE_NAME);
            if (fs.existsSync(cfg)) fs.chmodSync(cfg, 0o666);
            fs.rmSync(dir, { recursive: true, force: true });
        } catch { /* best effort */ }
    }
}

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
// 1. Non-object config files: defaults, no crash, file untouched
// -----------------------------------------------------------------------------

console.log('\n-- non-object config files (valid JSON, wrong shape) -----------');

for (const content of ['null', '[]', '"hello"', '42', 'true']) {
    const dir = makeConfigDir(content);
    let config, crashed = false;
    try {
        config = loadFrom(dir);
    } catch {
        crashed = true;
    }
    const fileAfter = fs.readFileSync(path.join(dir, CONFIG_FILE_NAME), 'utf-8');

    assert(`config = ${content.padEnd(7)} → no crash`, !crashed);
    assert(`config = ${content.padEnd(7)} → defaults used`,
        !crashed && config.configIsDefault === true && config.selectedStandard === STANDARDS.WCAG_AA);
    assert(`config = ${content.padEnd(7)} → file NOT overwritten`,
        fileAfter === content, `file now contains: ${fileAfter.slice(0, 60)}`);
}

// -----------------------------------------------------------------------------
// 2. Partial config: missing keys filled from defaults
// -----------------------------------------------------------------------------

console.log('\n-- partial config (hand-edited, keys missing) ------------------');

{
    const dir = makeConfigDir('{"configVersion":1}');
    const config = loadFrom(dir);
    assert('selectedStandard filled', config.selectedStandard === STANDARDS.WCAG_AA);
    assert('scan.defaultMode filled', config.scan?.defaultMode === SCAN_MODES.QUICK);
    assert('rules.rtl filled',        config.rules?.rtl === false);
    assert('ai.enabled filled',       config.ai?.enabled === false);
    assert('configIsDefault is false (file existed)', config.configIsDefault === false);
}

{
    // User-set values must survive the default merge.
    const dir = makeConfigDir(JSON.stringify({
        configVersion: 1,
        selectedStandard: STANDARDS.WCAG_AAA,
        rules: { rtl: true },
    }));
    const config = loadFrom(dir);
    assert('user selectedStandard preserved', config.selectedStandard === STANDARDS.WCAG_AAA);
    assert('user rules.rtl preserved',        config.rules.rtl === true);
    assert('untouched section still defaulted', config.scan.defaultMode === SCAN_MODES.QUICK);
}

// -----------------------------------------------------------------------------
// 3. Read-only config needing migration: no crash, in-memory migration
// -----------------------------------------------------------------------------

console.log('\n-- read-only config needing migration --------------------------');

{
    const dir = makeConfigDir(JSON.stringify({ selectedStandard: STANDARDS.WCAG_AA })); // v0: no configVersion
    const cfgPath = path.join(dir, CONFIG_FILE_NAME);
    fs.chmodSync(cfgPath, 0o444);

    let config, crashed = false;
    try {
        config = loadFrom(dir);
    } catch {
        crashed = true;
    }
    assert('no crash when config file is read-only', !crashed);
    assert('migration applied in-memory', !crashed && config.configVersion >= 1);
    fs.chmodSync(cfgPath, 0o666);
}

// -----------------------------------------------------------------------------
// 4. DEFAULT_CONFIG isolation: returned configs share no nested references
// -----------------------------------------------------------------------------

console.log('\n-- DEFAULT_CONFIG isolation ------------------------------------');

{
    const dir = makeConfigDir(undefined); // no config file → defaults path
    const config = loadFrom(dir);
    config.scan.defaultMode = 'MUTATED';
    config.rules.rtl = 'MUTATED';
    assert('mutating loaded config does not corrupt DEFAULT_CONFIG.scan',
        DEFAULT_CONFIG.scan.defaultMode === SCAN_MODES.QUICK);
    assert('mutating loaded config does not corrupt DEFAULT_CONFIG.rules',
        DEFAULT_CONFIG.rules.rtl === false);
}

// -----------------------------------------------------------------------------
// 5. E2E: `allycat scan` survives a partial config
// -----------------------------------------------------------------------------

console.log('\n-- e2e: scan with partial config -------------------------------');

{
    const dir = makeConfigDir('{"configVersion":1}');
    fs.writeFileSync(
        path.join(dir, 'page.html'),
        '<html lang="en"><head><title>t</title></head><body><main><h1>hi</h1></main></body></html>'
    );
    const result = spawnSync('node', [CLI, 'scan', 'page.html'], { encoding: 'utf8', cwd: dir });
    const output = `${result.stdout}${result.stderr}`;
    assert('scan exits 0', result.status === 0, `exit ${result.status}`);
    assert('no TypeError in output', !output.includes('TypeError'), output.slice(-300));
}

// -----------------------------------------------------------------------------
// 6. Invalid config values: warn + fallback, file untouched
// -----------------------------------------------------------------------------

console.log('\n-- invalid config values (warn + fallback) ---------------------');

/** Run loadFrom while capturing console.warn output. */
function loadCapturingWarnings(dir) {
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (msg) => warnings.push(String(msg));
    try {
        return { config: loadFrom(dir), warnings };
    } finally {
        console.warn = originalWarn;
    }
}

{
    const content = JSON.stringify({
        configVersion: 1,
        selectedStandard: 'wcag-aaaaa',
        scan:  { defaultMode: 'turbo' },
        rules: { rtl: 'yes' },
        ai:    { enabled: false, reportBehavior: 'always' },
    });
    const dir = makeConfigDir(content);
    const { config, warnings } = loadCapturingWarnings(dir);
    const fileAfter = fs.readFileSync(path.join(dir, CONFIG_FILE_NAME), 'utf-8');

    assert('invalid selectedStandard → default',  config.selectedStandard === STANDARDS.WCAG_AA);
    assert('invalid scan.defaultMode → default',  config.scan.defaultMode === SCAN_MODES.QUICK);
    assert('truthy-string rules.rtl → false (not coerced)', config.rules.rtl === false);
    assert('invalid ai.reportBehavior → path-only', config.ai.reportBehavior === 'path-only');
    assert('a warning was emitted per invalid field', warnings.length === 4,
        `got ${warnings.length}: ${warnings.join(' | ')}`);
    assert('warning names the bad value', warnings.some(w => w.includes('wcag-aaaaa')));
    assert('file NOT rewritten with corrections', fileAfter === content);

    // scan.js loads config twice per run (mode read + final load) — warnings
    // must dedupe per process, not repeat on every load.
    const second = loadCapturingWarnings(dir);
    assert('reloading same config does not re-warn', second.warnings.length === 0,
        second.warnings.join(' | '));
}

{
    // Valid non-default values must pass through with zero warnings.
    const dir = makeConfigDir(JSON.stringify({
        configVersion: 1,
        selectedStandard: STANDARDS.WCAG_AAA,
        scan:  { defaultMode: SCAN_MODES.FULL },
        rules: { rtl: true },
        ai:    { enabled: true, reportBehavior: 'auto-open' },
    }));
    const { config, warnings } = loadCapturingWarnings(dir);

    assert('valid selectedStandard preserved',   config.selectedStandard === STANDARDS.WCAG_AAA);
    assert('valid scan.defaultMode preserved',   config.scan.defaultMode === SCAN_MODES.FULL);
    assert('valid rules.rtl preserved',          config.rules.rtl === true);
    assert('valid ai.reportBehavior preserved',  config.ai.reportBehavior === 'auto-open');
    assert('no warnings for valid values', warnings.length === 0, warnings.join(' | '));
}

{
    // Absent ai.reportBehavior must stay absent (reportOutputter applies its own default).
    const dir = makeConfigDir('{"configVersion":1}');
    const config = loadFrom(dir);
    assert('absent ai.reportBehavior stays absent', !('reportBehavior' in config.ai));
}

// -----------------------------------------------------------------------------
// 7. E2E: scan with invalid selectedStandard warns and shows the real standard
// -----------------------------------------------------------------------------

console.log('\n-- e2e: scan with invalid selectedStandard ---------------------');

{
    const dir = makeConfigDir(JSON.stringify({ configVersion: 1, selectedStandard: 'wcag-aaaaa' }));
    fs.writeFileSync(
        path.join(dir, 'page.html'),
        '<html lang="en"><head><title>t</title></head><body><main><h1>hi</h1></main></body></html>'
    );
    const result = spawnSync('node', [CLI, 'scan', 'page.html'], { encoding: 'utf8', cwd: dir });
    const output = `${result.stdout}${result.stderr}`;

    assert('scan exits 0', result.status === 0, `exit ${result.status}`);
    assert('warning emitted for invalid standard',
        output.includes('selectedStandard "wcag-aaaaa" is not a valid value'), output.slice(-300));
    assert('banner shows the standard actually used', output.includes('WCAG 2.1 AA'));
    assert('banner no longer echoes the typo', !output.includes('WCAG-AAAAA'));
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

cleanup();

const total = passed + failed;
console.log(`\n  ${passed}/${total} passed\n`);
if (failed > 0) process.exit(1);
