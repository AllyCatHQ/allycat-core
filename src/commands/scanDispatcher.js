/**
 * Scan Dispatcher
 *
 * Owns input resolution (target path or changed-file list) and scanner
 * selection (quick vs full). Isolates all "how to run the scan" concerns
 * from the top-level orchestrator.
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { runQuickAudit } from '../engine/scanners/quickScanner.js';
import { runFullAudit, checkPlaywrightAvailable } from '../engine/scanners/fullScanner.js';
import { resolveExcludePatterns, matchesExcludePatterns, filterNeverScan } from '../utils/pathUtils.js';
import { SUPPORTED_EXTENSIONS, MESSAGES, SCAN_MODES } from '../constants.js';

// -----------------------------------------------------------------------------
// Input Resolution
// -----------------------------------------------------------------------------

/**
 * Resolve the scan input: either a list of git-changed files or a validated target path.
 *
 * @param {string|null} target - Target path from CLI
 * @param {Object} options - CLI options
 * @returns {Promise<{targetPath: string|null, preResolvedFiles: string[]|null}|null>}
 *   - null signals the caller to abort
 */
export async function resolveInputFiles(target, options) {
    if (options.changed) {
        const preResolvedFiles = await resolveChangedFiles(target);
        if (preResolvedFiles === null) {
            return null;
        }
        if (preResolvedFiles.length === 0) {
            p.log.info('No changed scannable files found. Nothing to scan.');
            p.outro(chalk.dim('Done.'));
            return null;
        }
        p.log.info(`${chalk.cyan(preResolvedFiles.length)} changed file${preResolvedFiles.length > 1 ? 's' : ''} found.`);
        return { targetPath: null, preResolvedFiles };
    }

    const targetPath = validateAndResolveTarget(target);
    if (target && targetPath === null) {
        return null;
    }
    return { targetPath, preResolvedFiles: null };
}

/**
 * Validate and resolve target path
 *
 * @param {string|null} target - Target path from CLI
 * @returns {string|null} - Resolved target or null if invalid
 */
function validateAndResolveTarget(target) {
    if (!target) {
        return null;
    }

    const absolutePath = path.resolve(process.cwd(), target);

    if (!fs.existsSync(absolutePath)) {
        p.log.error(chalk.red(`Target path not found: ${target}`));
        p.outro(chalk.yellow(MESSAGES.VALID_PATH_REQUIRED));
        return null;
    }

    const stats = fs.statSync(absolutePath);
    const targetType = stats.isDirectory() ? 'Directory' : 'File';
    p.log.info(`Target: ${chalk.cyan(target)} (${targetType})`);

    // Return relative path for cleaner output
    return target;
}

/**
 * Resolve files changed since the previous commit via git diff.
 * Filters to scannable extensions, skips deleted files, and scopes
 * to an optional target path.
 *
 * @param {string|null} target - Optional path scope from CLI
 * @returns {Promise<string[]|null>} - File list, or null on git error
 */
async function resolveChangedFiles(target) {
    let output;
    try {
        output = execSync('git diff --name-only HEAD~1', {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
        });
    } catch (error) {
        const msg = error.stderr || error.message || '';
        if (msg.includes('not a git repository')) {
            p.log.error(chalk.red('Not a git repository — --changed requires git.'));
            p.outro(chalk.yellow('Run from inside a git repository.'));
        } else if (msg.includes('unknown revision') || msg.includes('bad revision')) {
            p.log.error(chalk.red('No previous commit to compare against.'));
            p.outro(chalk.yellow('--changed requires at least two commits.'));
        } else {
            p.log.error(chalk.red(`git error: ${msg.trim()}`));
        }
        return null;
    }

    const files = output
        .trim()
        .split('\n')
        .filter(f => f && SUPPORTED_EXTENSIONS.some(ext => f.endsWith(`.${ext}`)))
        .filter(f => fs.existsSync(f));

    if (!target) {
        return files;
    }

    const absoluteScope = path.resolve(process.cwd(), target);
    return files.filter(f => {
        const absoluteFilePath = path.resolve(process.cwd(), f);
        return absoluteFilePath === absoluteScope || absoluteFilePath.startsWith(absoluteScope + path.sep);
    });
}

// -----------------------------------------------------------------------------
// Scan Execution
// -----------------------------------------------------------------------------

/**
 * Execute the accessibility scan
 *
 * @param {Object} config - User configuration
 * @param {string} scanMode - 'quick' or 'full'
 * @param {string|null} targetPath - Target path to scan
 * @param {string[]|null} preResolvedFiles - Pre-resolved file list (--changed mode)
 * @returns {Promise<{violations: Array, warnings: Array}|null>} - Scan result or null on error
 */
export async function executeScan(config, scanMode, targetPath, preResolvedFiles = null, excludes = [], ignoreFilePatterns = []) {
    const allExcludes = [...excludes, ...ignoreFilePatterns];

    if (preResolvedFiles) {
        preResolvedFiles = filterNeverScan(preResolvedFiles);
        if (allExcludes.length) {
            const patterns = resolveExcludePatterns(allExcludes);
            preResolvedFiles = preResolvedFiles.filter(
                f => !matchesExcludePatterns(f.replace(/\\/g, '/'), patterns)
            );
        }
    }

    const spinner = p.spinner();
    spinner.start(MESSAGES.ANALYZING);

    let completed = 0;
    let total = 0;

    const onProgress = ({ type, filePath, elapsed, total: fileTotal }) => {
        if (type === 'start' && fileTotal) total = fileTotal;
        if (type === 'done') {
            completed++;
            spinner.message(`Scanning... (${completed}/${total})`);
        }
        if (type === 'slow') {
            const name = path.basename(filePath);
            spinner.message(`Scanning... (${completed}/${total}) — slow: ${name} (${(elapsed / 1000).toFixed(1)}s+)`);
        }
    };

    try {
        const result = scanMode === SCAN_MODES.FULL
            ? await runFullAudit(config, targetPath, preResolvedFiles, false, allExcludes, onProgress)
            : await runQuickAudit(config, targetPath, preResolvedFiles, false, allExcludes, onProgress);

        spinner.stop(chalk.green(MESSAGES.ANALYSIS_COMPLETE));
        return result;

    } catch (error) {
        spinner.stop(chalk.red(MESSAGES.ANALYSIS_FAILED));
        handleScanError(error);
        return null;
    }
}

/**
 * Verify Playwright is available before file resolution begins.
 * Returns true on success. On failure, logs the error and returns false
 * so the caller can abort without doing unnecessary file work.
 *
 * No-ops for quick mode.
 *
 * @param {string} scanMode - 'quick' or 'full'
 * @returns {Promise<boolean>}
 */
export async function preflightScan(scanMode) {
    if (scanMode !== SCAN_MODES.FULL) return true;
    try {
        await checkPlaywrightAvailable();
        return true;
    } catch (error) {
        p.log.error(error.message);
        return false;
    }
}

/**
 * Handle scan errors
 *
 * @param {Error} error - The caught error
 */
function handleScanError(error) {
    p.log.error(error.message);
}
