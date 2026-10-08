/**
 * Fix Command
 *
 * Hands the violations saved by the last `allycat scan` to Claude Code,
 * opened in a new terminal tab. Never scans and never modifies the saved file.
 *
 * Test hook: ALLYCAT_NO_LAUNCH=1 prints the command instead of opening a terminal.
 */

import chalk from 'chalk';
import path from 'path';
import { openInTerminal } from '../utils/terminalOpener.js';
import { getLastScanPath, loadLastScan } from '../utils/lastScanStore.js';
import { formatScanAge, countChangedFiles, plural } from '../utils/scanFreshness.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function fixCommand() {
    const scanPath = getLastScanPath();
    const result = loadLastScan();

    if (result.status === 'missing') {
        console.log(chalk.yellow('No scan found. Run `allycat scan` first.'));
        process.exitCode = 1;
        return;
    }

    if (result.status === 'invalid') {
        console.log(chalk.yellow('The saved scan could not be read. Run `allycat scan` again.'));
        process.exitCode = 1;
        return;
    }

    const { cwd, violations } = result.data;

    if (!isSameFolder(cwd, process.cwd())) {
        console.log(chalk.yellow(`Last scan was for \`${cwd}\`, not this folder. Run \`allycat scan\` here first.`));
        process.exitCode = 1;
        return;
    }

    if (violations.length === 0) {
        console.log(chalk.green('Nothing to fix — the last scan found no violations.'));
        return;
    }

    const count = plural(violations.length, 'violation');
    printFreshness(result.data, count);

    const prompt = `Read ${scanPath} — it lists ${count} found by AllyCat, an accessibility scanner. ` +
        `Make targeted fixes to each violation it lists. Do not rewrite whole files.`;

    console.log(chalk.dim(`Handing ${count} to Claude Code...`));

    if (process.env.ALLYCAT_NO_LAUNCH === '1') {
        console.log(`claude "${prompt}"`);
        return;
    }

    openInTerminal('claude', [prompt], { cwd: process.cwd() });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Print the scan's age and, if any scanned files changed since, a warning.
 * Warn only — never blocks. An unknown scan time skips the file check.
 *
 * @param {{ scannedAt?: string, cwd: string, violations: Array }} data - Saved scan
 * @param {string} count - e.g. "5 violations"
 */
function printFreshness({ scannedAt, cwd, violations }, count) {
    const scannedAtMs = Date.parse(scannedAt);

    if (Number.isNaN(scannedAtMs)) {
        console.log(`Using scan from an unknown time (${count})`);
        return;
    }

    console.log(`Using scan from ${formatScanAge(scannedAtMs)} (${count})`);

    const changed = countChangedFiles(violations, cwd, scannedAtMs);
    if (changed > 0) {
        console.log(chalk.yellow(`⚠ ${plural(changed, 'file')} changed since this scan. Run \`allycat scan\` to refresh.`));
    }
}

/**
 * Compare two folder paths. On Windows, case and slash direction are ignored.
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function isSameFolder(a, b) {
    if (typeof a !== 'string') return false;
    const normalize = (p) => {
        const resolved = path.resolve(p);
        return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
    };
    return normalize(a) === normalize(b);
}
