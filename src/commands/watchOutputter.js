/**
 * Watch Outputter
 *
 * Terminal UI rendering for watch mode.
 * All console output and screen management for watch mode lives here.
 *
 * Responsibilities:
 *  - Clear and reset the terminal between render cycles
 *  - Render the watch mode banner
 *  - Render the baseline summary on startup
 *  - Render the NEW / FIXED delta after each rescan
 *  - Render the current open violations after each delta
 *  - Render in-progress "rescanning" state while a scan is running
 *  - Render the persistent status line (file count, violation count, hint)
 *
 * @module commands/watchOutputter
 */

import chalk from 'chalk';
import { formatImpactLabel, formatLineHint } from '../utils/violationFormatter.js';
import { totalViolations, bySeverity } from './watchState.js';

// -----------------------------------------------------------------------------
// Screen management
// -----------------------------------------------------------------------------

/**
 * Clear the terminal reliably across platforms.
 * console.clear() is unreliable in VSCode's integrated terminal on Windows.
 * \x1Bc (ESC c) is the full terminal reset sequence used by Vite, Next.js, and
 * other modern dev tools. It clears the visible screen, scrollback buffer, and
 * resets any active clack/ANSI session state — giving a truly blank slate.
 */
export function clearScreen() {
    console.clear();
    process.stdout.write('\x1Bc');
}

export function printBanner() {
    console.log(chalk.bold.magenta('  ◈  A11y-Guard  —  Watch Mode'));
    console.log('');
}

// -----------------------------------------------------------------------------
// Baseline
// -----------------------------------------------------------------------------

export function printBaselineSummary(state, summaryMode = false, fileCount = 0) {
    const total = totalViolations(state);
    if (total === 0) {
        console.log(chalk.green('  ✔  No violations in initial scan'));
        return;
    }

    // Clean-files overview: shown once at startup to orient the user
    const filesWithViolations = state.size;
    const cleanFiles = fileCount - filesWithViolations;
    if (cleanFiles > 0) {
        console.log(
            chalk.green(`  ✔  ${cleanFiles} file${cleanFiles !== 1 ? 's' : ''} clean`) +
            chalk.dim('  ·  ') +
            chalk.red(`${filesWithViolations} file${filesWithViolations !== 1 ? 's' : ''} with violations`)
        );
        console.log('');
    }

    if (summaryMode) {
        for (const [file, violations] of state) {
            const count = violations.length;
            console.log(`  ${chalk.bold.cyan('◆')}  ${chalk.bold(file)}  ${chalk.red(`${count} violation${count !== 1 ? 's' : ''}`)}  ${chalk.dim('(baseline)')}`);
        }
        return;
    }
    for (const [file, violations] of state) {
        console.log(`  ${chalk.bold.cyan('◆')}  ${chalk.bold(file)}  ${chalk.dim('(baseline)')}`);
        console.log('');
        for (const v of [...violations].sort(bySeverity)) {
            const impact   = formatImpactLabel(v.impact);
            const lineHint = formatLineHint(v.lineNumber);
            console.log(`  ${chalk.cyan('○ EXISTS')}  ${chalk.dim(impact)} ${v.description}${lineHint}`);
        }
        console.log('');
    }
}

// -----------------------------------------------------------------------------
// Delta rendering
// -----------------------------------------------------------------------------

export function printDelta(filepath, added, fixed, summaryMode = false) {
    const time = new Date().toLocaleTimeString();
    console.log(`  ${chalk.bold.cyan('◆')}  ${chalk.bold(filepath)}  ${chalk.dim(time)}`);
    console.log('');

    if (added.length === 0 && fixed.length === 0) {
        console.log(chalk.dim('  ─  No change in violations'));
        return;
    }

    if (summaryMode) {
        const parts = [];
        if (added.length > 0) {
            const worst = [...added].sort(bySeverity)[0].impact ?? 'unknown';
            parts.push(chalk.red(`● +${added.length} new`) + chalk.dim(` [${worst.toUpperCase()}]`));
        }
        if (fixed.length > 0) {
            const best = [...fixed].sort(bySeverity)[0].impact ?? 'unknown';
            parts.push(chalk.green(`✓ -${fixed.length} fixed`) + chalk.dim(` [${best.toUpperCase()}]`));
        }
        console.log(`  ${parts.join(chalk.dim('  ·  '))}`);
        return;
    }

    const sorted = [
        ...fixed.sort(bySeverity).map(v => ({ v, type: 'fixed' })),
        ...added.sort(bySeverity).map(v => ({ v, type: 'added' })),
    ];

    for (const { v, type } of sorted) {
        const impact   = formatImpactLabel(v.impact);
        const lineHint = formatLineHint(v.lineNumber);

        if (type === 'fixed') {
            console.log(`  ${chalk.green('✓ FIXED')}  ${chalk.dim(impact)} ${v.description}${lineHint}`);
        } else {
            console.log(`  ${chalk.red('● NEW  ')}  ${chalk.bold.red(impact)} ${v.description}${lineHint}`);
        }
    }
}

/**
 * Render the full current violations for a file after showing the delta.
 * This ensures users always know what still needs fixing, not just what changed.
 *
 * @param {Array}   violations  - Current violations after rescan
 * @param {boolean} summaryMode
 */
export function printCurrent(violations, summaryMode) {
    console.log('');

    if (violations.length === 0) {
        console.log(chalk.green('  ✔  All violations cleared'));
        return;
    }

    const label = `Still open (${violations.length})`;

    if (summaryMode) {
        const worst = [...violations].sort(bySeverity)[0].impact ?? 'unknown';
        console.log(chalk.dim(`  ─  ${label}`) + chalk.dim(`  [${worst.toUpperCase()}]`));
        return;
    }

    console.log(chalk.dim(`  ─  ${label}:`));
    for (const v of [...violations].sort(bySeverity)) {
        const impact   = formatImpactLabel(v.impact);
        const lineHint = formatLineHint(v.lineNumber);
        console.log(`  ${chalk.cyan('○')}  ${chalk.dim(impact)} ${v.description}${lineHint}`);
    }
}

// -----------------------------------------------------------------------------
// In-progress state
// -----------------------------------------------------------------------------

/**
 * Render existing violations for a file while a rescan is in progress.
 * Keeps violations visible so users can see what they're fixing.
 */
export function printRescanning(filepath, violations, summaryMode) {
    console.log(`  ${chalk.bold.cyan('◌')}  ${chalk.bold(filepath)}  ${chalk.dim('rescanning...')}`);
    console.log('');

    if (violations.length === 0) {
        console.log(chalk.dim('  ─  No previous violations'));
        console.log('');
        return;
    }

    if (summaryMode) {
        const count = violations.length;
        console.log(chalk.dim(`  ${count} violation${count !== 1 ? 's' : ''} (rescanning...)`));
        console.log('');
        return;
    }

    for (const v of [...violations].sort(bySeverity)) {
        const impact   = formatImpactLabel(v.impact);
        const lineHint = v.lineNumber ? `  — Line ${v.lineNumber}` : '';
        console.log(chalk.dim(`  ○        ${impact} ${v.description}${lineHint}`));
    }
    console.log('');
}

// -----------------------------------------------------------------------------
// Status line
// -----------------------------------------------------------------------------

export function printStatusLine(fileCount, total) {
    console.log('');
    console.log(chalk.dim('  ─────────────────────────────────────────────────────'));
    console.log(
        chalk.dim(`  Watching ${fileCount} file${fileCount !== 1 ? 's' : ''}`) +
        chalk.dim('  ·  ') +
        (total === 0 ? chalk.green('No violations') : chalk.red(`${total} violation${total !== 1 ? 's' : ''}`)) +
        chalk.dim('  ·  Ctrl+C to stop')
    );
}
