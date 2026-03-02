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
import { resolveFiles, SUPPORTED_EXTENSIONS } from '../utils/fileResolver.js';
import { runQuickAudit } from '../engine/scanners/quickScanner.js';
import { runFullAudit } from '../engine/scanners/fullScanner.js';
import { SCAN_MODES } from '../constants.js';

// Impact display order for sorting delta output
const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };

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
export async function watchMode(target, config, scanMode) {
    const files = await resolveFiles(config, target || null);

    if (files.length === 0) {
        p.log.warn('No scannable files found to watch.');
        return;
    }

    // ── Initial scan ─────────────────────────────────────────────────────────
    console.clear();
    printBanner();
    console.log(chalk.dim(`  Scanning ${files.length} file${files.length !== 1 ? 's' : ''} for baseline...`));
    console.log('');

    const state = new Map(); // Map<normalizedPath, violation[]>

    const initial = scanMode === SCAN_MODES.FULL
        ? await runFullAudit(config, target || null, null)
        : await runQuickAudit(config, target || null, null);

    for (const v of initial) {
        const key = normPath(v.file);
        if (!state.has(key)) state.set(key, []);
        state.get(key).push(v);
    }

    console.clear();
    printBanner();
    printBaselineSummary(state);
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
            await handleChange(filepath, state, config, scanMode, files.length);
        }, 300));
    };

    watcher.on('change', scheduleRescan);
    watcher.on('add',    scheduleRescan);

    watcher.on('unlink', (filepath) => {
        state.delete(normPath(filepath));
        console.clear();
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
 * @param {number}  fileCount - Total watched file count (for status line)
 */
async function handleChange(filepath, state, config, scanMode, fileCount) {
    // Immediate feedback — user sees the tool reacted before the scan finishes
    console.clear();
    printBanner();
    console.log(chalk.dim(`  ◌  Rescanning ${filepath}...`));

    const key = normPath(filepath);
    const previous = state.get(key) ?? [];

    const current = await scanOneFile(filepath, config, scanMode);

    // Indexed keys handle duplicates: two violations with the same rule+html
    // but unresolved line numbers get distinct keys (base#0, base#1).
    const prevIndexed = indexedKeys(previous);
    const currIndexed = indexedKeys(current);
    const prevSet = new Set(prevIndexed);
    const currSet = new Set(currIndexed);

    const added = current.filter((_, i) => !prevSet.has(currIndexed[i]));
    const fixed = previous.filter((_, i) => !currSet.has(prevIndexed[i]));

    state.set(key, current);

    console.clear();
    printBanner();
    printDelta(filepath, added, fixed);
    printStatusLine(fileCount, totalViolations(state));
}

/**
 * Scan a single file.
 * Passes [filepath] directly to the scanner — no glob resolution needed.
 *
 * @param {string}  filepath  - File to scan
 * @param {Object}  config    - User configuration
 * @param {string}  scanMode  - 'quick' | 'full'
 * @returns {Promise<Array>}  - Violations for this file only
 */
async function scanOneFile(filepath, config, scanMode) {
    try {
        const violations = scanMode === SCAN_MODES.FULL
            ? await runFullAudit(config, null, [filepath])
            : await runQuickAudit(config, null, [filepath]);

        // Normalize and filter to this file — scanners return full violation arrays
        return violations.filter(v => normPath(v.file) === normPath(filepath));
    } catch {
        return [];
    }
}

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------

function printBanner() {
    console.log(chalk.bold.magenta('  ◈  A11y-Guard  —  Watch Mode'));
    console.log('');
}

function printBaselineSummary(state) {
    const total = totalViolations(state);
    if (total === 0) {
        console.log(chalk.green('  ✔  No violations in initial scan'));
        return;
    }
    for (const [file, violations] of state) {
        console.log(`  ${chalk.bold.cyan('◆')}  ${chalk.bold(file)}  ${chalk.dim('(baseline)')}`);
        console.log('');
        for (const v of [...violations].sort(bySeverity)) {
            const impact   = `[${(v.impact || 'unknown').toUpperCase()}]`;
            const lineHint = v.lineNumber ? chalk.dim(`  — Line ${v.lineNumber}`) : '';
            console.log(`  ${chalk.cyan('○ EXISTS')}  ${chalk.dim(impact)} ${v.description}${lineHint}`);
        }
        console.log('');
    }
}

function printDelta(filepath, added, fixed) {
    const time = new Date().toLocaleTimeString();
    console.log(`  ${chalk.bold.cyan('◆')}  ${chalk.bold(filepath)}  ${chalk.dim(time)}`);
    console.log('');

    if (added.length === 0 && fixed.length === 0) {
        console.log(chalk.dim('  ─  No change in violations'));
        return;
    }

    const sorted = [
        ...fixed.sort(bySeverity).map(v => ({ v, type: 'fixed' })),
        ...added.sort(bySeverity).map(v => ({ v, type: 'added' })),
    ];

    for (const { v, type } of sorted) {
        const impact  = `[${(v.impact || 'unknown').toUpperCase()}]`;
        const lineHint = v.lineNumber ? chalk.dim(`  — Line ${v.lineNumber}`) : '';

        if (type === 'fixed') {
            console.log(`  ${chalk.green('✓ FIXED')}  ${chalk.dim(impact)} ${v.description}${lineHint}`);
        } else {
            console.log(`  ${chalk.red('● NEW  ')}  ${chalk.bold.red(impact)} ${v.description}${lineHint}`);
        }
    }
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
 * Base identity key for a violation (rule + line + html snippet).
 * Used internally by indexedKeys — not compared directly.
 */
function violationKey(v) {
    return `${v.id}|${v.lineNumber ?? ''}|${(v.html ?? '').slice(0, 80)}`;
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
