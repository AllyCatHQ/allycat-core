/**
 * Watch Mode
 *
 * Watches source files for changes and re-scans incrementally.
 * Shows only the delta (NEW / FIXED) on each cycle — not the full result.
 *
 * Design:
 *  - chokidar handles cross-platform FS events (FSEvents / inotify / ReadDirectoryChanges)
 *  - Per-file scan: passes [filepath] directly to the scanner, skipping full resolution
 *  - State is a Map<normalizedPath, violation[]> updated after every rescan
 *  - Delta is computed by comparing violation keys before and after each rescan
 *  - 300 ms debounce prevents scan storms on editors that auto-save on every keystroke
 *  - Terminal is cleared before each delta render for a clean rolling display
 *
 * @module commands/watchMode
 */

import chokidar from 'chokidar';
import chalk from 'chalk';
import path from 'path';
import * as p from '@clack/prompts';
import { resolveFiles } from '../utils/fileResolver.js';
import { SUPPORTED_EXTENSIONS, SCAN_MODES, IMPACT_ORDER } from '../constants.js';
import { runQuickAudit } from '../engine/scanners/quickScanner.js';
import { runFullAudit } from '../engine/scanners/fullScanner.js';
import { formatImpactLabel, formatLineHint } from '../utils/violationFormatter.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Start watch mode: initial scan, then re-scan on every file change.
 *
 * @param {string|null} target    - Optional file/directory to scope the watch
 * @param {Object}      config    - User configuration from a11y-config.json
 * @param {string}      scanMode  - 'quick' | 'full'
 */
export async function watchMode(target, config, scanMode, options = {}) {
    const files = await resolveFiles(config, target || null);

    if (files.length === 0) {
        p.log.warn('No scannable files found to watch.');
        return;
    }

    // ── Initial scan ─────────────────────────────────────────────────────────
    clearScreen();
    printBanner();
    console.log(chalk.dim(`  Scanning ${files.length} file${files.length !== 1 ? 's' : ''} for baseline...`));
    console.log('');

    const state = new Map(); // Map<normalizedPath, violation[]>

    const initialResult = scanMode === SCAN_MODES.FULL
        ? await runFullAudit(config, target || null, null)
        : await runQuickAudit(config, target || null, null);

    populateStateFromResult(state, initialResult.violations);

    clearScreen();
    printBanner();
    // Default: compact count-per-file. With --existing (-e): full detail list.
    printBaselineSummary(state, !(options.existing ?? false), files.length);
    printStatusLine(files.length, totalViolations(state));

    // ── Watcher ──────────────────────────────────────────────────────────────
    const watchPaths = target ? [target] : ['.'];

    const watcher = chokidar.watch(watchPaths, {
        ignored: [/node_modules/, /[/\\]\./, /dist[/\\]/, /build[/\\]/],
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 100, pollInterval: 50 },
    });

    const timers = new Map(); // debounce: filepath → timeout handle

    const scheduleRescan = (filepath) => {
        if (!SUPPORTED_EXTENSIONS.some(ext => filepath.endsWith(`.${ext}`))) return;

        if (timers.has(filepath)) clearTimeout(timers.get(filepath));

        timers.set(filepath, setTimeout(async () => {
            timers.delete(filepath);
            await handleChange(filepath, state, config, scanMode, files.length, options.summary ?? false);
        }, 300));
    };

    watcher.on('change', scheduleRescan);
    watcher.on('add',    scheduleRescan);

    watcher.on('unlink', (filepath) => {
        state.delete(normPath(filepath));
        clearScreen();
        printBanner();
        console.log(chalk.dim(`  ○  ${filepath} removed`));
        printStatusLine(files.length, totalViolations(state));
    });

    // ── Ctrl+C ───────────────────────────────────────────────────────────────
    process.on('SIGINT', () => {
        watcher.close().then(() => {
            const total = totalViolations(state);
            console.log('\n');
            p.outro(
                chalk.cyan('Watch stopped.') + '  ' +
                (total > 0
                    ? chalk.red(`${total} violation${total !== 1 ? 's' : ''} remaining.`)
                    : chalk.green('No violations found.'))
            );
            process.exit(0);
        });
    });
}

// -----------------------------------------------------------------------------
// Per-file rescan + delta
// -----------------------------------------------------------------------------

/**
 * Rescan one changed file, compute delta, update state, and render.
 *
 * @param {string}  filepath  - Changed file path (as reported by chokidar)
 * @param {Map}     state     - Current violation state (mutated in-place)
 * @param {Object}  config    - User configuration
 * @param {string}  scanMode  - 'quick' | 'full'
 * @param {number}  fileCount   - Total watched file count (for status line)
 * @param {boolean} summaryMode - Show counts only instead of full violation details
 */
async function handleChange(filepath, state, config, scanMode, fileCount, summaryMode = false) {
    const key = normPath(filepath);
    const previous = state.get(key) ?? [];

    // Show existing violations while rescanning — don't blank them out mid-edit
    clearScreen();
    printBanner();
    printRescanning(filepath, previous, summaryMode);
    printStatusLine(fileCount, totalViolations(state));

    const current = await scanOneFile(filepath, config, scanMode);

    // Scan failed (parse/syntax error — file may be in a partial edit state).
    // Keep the previous violations intact so they don't vanish mid-fix.
    if (current === null) {
        clearScreen();
        printBanner();
        console.log(chalk.yellow(`  ⚠  Parse error in ${path.basename(filepath)} — violations unchanged`));
        console.log('');
        printRescanning(filepath, previous, summaryMode);
        printStatusLine(fileCount, totalViolations(state));
        return;
    }

    // Indexed keys handle duplicates: two violations with the same rule+html
    // but unresolved line numbers get distinct keys (base#0, base#1).
    const { added, fixed } = computeDelta(previous, current);

    state.set(key, current);

    clearScreen();
    printBanner();
    printDelta(filepath, added, fixed, summaryMode);
    printCurrent(current, summaryMode);
    printStatusLine(fileCount, totalViolations(state));
}

/**
 * Returns violations for a single file, or null if the scan failed
 * (e.g. syntax error while the file is mid-edit).
 * Passes [filepath] directly to the scanner — no glob resolution needed.
 * Callers must treat null as "keep previous state" — not as "no violations".
 *
 * @param {string}  filepath  - File to scan
 * @param {Object}  config    - User configuration
 * @param {string}  scanMode  - 'quick' | 'full'
 * @returns {Promise<Array|null>}
 */
async function scanOneFile(filepath, config, scanMode) {
    try {
        const result = scanMode === SCAN_MODES.FULL
            ? await runFullAudit(config, null, [filepath], true)
            : await runQuickAudit(config, null, [filepath], true);

        // Normalize and filter to this file — scanners return full violation arrays
        return result.violations.filter(v => normPath(v.file) === normPath(filepath));
    } catch {
        return null;
    }
}

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------

/**
 * Clear the terminal reliably across platforms.
 * console.clear() is unreliable in VSCode's integrated terminal on Windows.
 * \x1Bc (ESC c) is the full terminal reset sequence used by Vite, Next.js, and
 * other modern dev tools. It clears the visible screen, scrollback buffer, and
 * resets any active clack/ANSI session state — giving a truly blank slate.
 */
function clearScreen() {
    console.clear();
    process.stdout.write('\x1Bc');
}

function printBanner() {
    console.log(chalk.bold.magenta('  ◈  A11y-Guard  —  Watch Mode'));
    console.log('');
}

function printBaselineSummary(state, summaryMode = false, fileCount = 0) {
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

function printDelta(filepath, added, fixed, summaryMode = false) {
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
function printCurrent(violations, summaryMode) {
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

/**
 * Render existing violations for a file while a rescan is in progress.
 * Keeps violations visible so users can see what they're fixing.
 */
function printRescanning(filepath, violations, summaryMode) {
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

function printStatusLine(fileCount, total) {
    console.log('');
    console.log(chalk.dim('  ─────────────────────────────────────────────────────'));
    console.log(
        chalk.dim(`  Watching ${fileCount} file${fileCount !== 1 ? 's' : ''}`) +
        chalk.dim('  ·  ') +
        (total === 0 ? chalk.green('No violations') : chalk.red(`${total} violation${total !== 1 ? 's' : ''}`)) +
        chalk.dim('  ·  Ctrl+C to stop')
    );
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Base identity key for a violation: rule id + html snippet only.
 * Line number is intentionally excluded — inserting/removing lines above a
 * violation shifts its line number without changing the violation itself, which
 * would cause false FIXED + NEW pairs on every Enter keypress.
 */
function violationKey(v) {
    return `${v.id}|${(v.html ?? '').slice(0, 80)}`;
}

/**
 * Build an array of unique keys for a violation list.
 * Duplicates (same rule, same html, same line) get a numeric suffix
 * (base#0, base#1) so copy-pasted identical elements are tracked correctly.
 *
 * @param {Array} violations
 * @returns {string[]}
 */
function indexedKeys(violations) {
    const counts = {};
    return violations.map(v => {
        const base = violationKey(v);
        const n = counts[base] = (counts[base] ?? -1) + 1;
        return `${base}#${n}`;
    });
}

/**
 * Group violations by normalized file path into the shared state map.
 * Each key maps to an array of violations for that file.
 *
 * @param {Map}   state      - Shared state map (mutated in-place)
 * @param {Array} violations - Flat violation array from a scan result
 */
function populateStateFromResult(state, violations) {
    for (const v of violations) {
        const key = normPath(v.file);
        if (!state.has(key)) state.set(key, []);
        state.get(key).push(v);
    }
}

/**
 * Compare previous and current violation lists using indexed keys.
 * Returns violations that are newly introduced (added) and violations
 * that have been resolved (fixed) since the last scan of this file.
 *
 * @param {Array} previous - Violations before the rescan
 * @param {Array} current  - Violations after the rescan
 * @returns {{ added: Array, fixed: Array }}
 */
function computeDelta(previous, current) {
    const prevIndexed = indexedKeys(previous);
    const currIndexed = indexedKeys(current);
    const prevSet = new Set(prevIndexed);
    const currSet = new Set(currIndexed);

    return {
        added: current.filter((_, i) => !prevSet.has(currIndexed[i])),
        fixed: previous.filter((_, i) => !currSet.has(prevIndexed[i])),
    };
}

function normPath(p_) {
    return path.normalize(p_).replace(/\\/g, '/');
}

function totalViolations(state) {
    let n = 0;
    for (const violations of state.values()) n += violations.length;
    return n;
}

function bySeverity(a, b) {
    return (IMPACT_ORDER[a.impact] ?? 4) - (IMPACT_ORDER[b.impact] ?? 4);
}
