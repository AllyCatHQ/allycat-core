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
 * Module boundaries:
 *  - watchState.js     — pure state helpers (keys, delta, path normalization)
 *  - watchOutputter.js — all terminal rendering
 *  - watchMode.js      — orchestration only (chokidar, scan dispatch, event loop)
 *
 * @module commands/watchMode
 */

import chokidar from 'chokidar';
import chalk from 'chalk';
import path from 'path';
import * as p from '@clack/prompts';
import { resolveFiles } from '../utils/fileResolver.js';
import { resolveExcludePatterns, matchesExcludePatterns } from '../utils/pathUtils.js';
import { SUPPORTED_EXTENSIONS, SCAN_MODES } from '../constants.js';
import { runQuickAudit } from '../engine/scanners/quickScanner.js';
import { runFullAudit } from '../engine/scanners/fullScanner.js';
import { groupViolationsByFile, computeDelta, normalizePath, totalViolations } from './watchState.js';
import { clearScreen, printBanner, printBaselineSummary, printStatusLine, printRescanning, printDelta, printCurrent } from './watchOutputter.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Start watch mode: initial scan, then re-scan on every file change.
 *
 * @param {string|null} target    - Optional file/directory to scope the watch
 * @param {Object}      config    - User configuration from allycat.config.json
 * @param {string}      scanMode  - 'quick' | 'full'
 */
export async function watchMode(target, config, scanMode, options = {}) {
    const excludes = options.exclude || [];
    const files = await resolveFiles(config, target || null, excludes);

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
        ? await runFullAudit(config, target || null, files, false, excludes)
        : await runQuickAudit(config, target || null, files, false, excludes);

    groupViolationsByFile(state, initialResult.violations);

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

    const debounceTimers = new Map(); // debounce: filepath → timeout handle
    const excludePatterns = resolveExcludePatterns(excludes);

    const scheduleRescan = (filepath) => {
        if (!SUPPORTED_EXTENSIONS.some(ext => filepath.endsWith(`.${ext}`))) return;

        const rel = path.relative(process.cwd(), path.resolve(filepath)).replace(/\\/g, '/');
        if (matchesExcludePatterns(rel, excludePatterns)) return;

        if (debounceTimers.has(filepath)) clearTimeout(debounceTimers.get(filepath));

        debounceTimers.set(filepath, setTimeout(async () => {
            debounceTimers.delete(filepath);
            await processFileChange(filepath, state, config, scanMode, files.length, options.summary ?? false);
        }, 300));
    };

    watcher.on('change', scheduleRescan);
    watcher.on('add',    scheduleRescan);

    watcher.on('unlink', (filepath) => {
        state.delete(normalizePath(filepath));
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
 * @param {string}  filepath    - Changed file path (as reported by chokidar)
 * @param {Map}     state       - Current violation state (mutated in-place)
 * @param {Object}  config      - User configuration
 * @param {string}  scanMode    - 'quick' | 'full'
 * @param {number}  fileCount   - Total watched file count (for status line)
 * @param {boolean} summaryMode - Show counts only instead of full violation details
 */
async function processFileChange(filepath, state, config, scanMode, fileCount, summaryMode = false) {
    const key = normalizePath(filepath);
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
        return result.violations.filter(v => normalizePath(v.file) === normalizePath(filepath));
    } catch {
        return null;
    }
}
