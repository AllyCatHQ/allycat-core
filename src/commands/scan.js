/**
 * Scan Command
 *
 * Orchestrates accessibility scanning with quick/full modes.
 * Outputs violations with precise location data.
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { loadConfig, configExists } from '../utils/configLoader.js';
import { initCommand } from './init.js';
import { runQuickAudit } from '../engine/quickScanner.js';
import { runFullAudit } from '../engine/fullScanner.js';
import { outputResults } from './scanOutputters.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Main scan command entry point
 *
 * @param {string|null} target - Optional file/folder path to scan
 * @param {Object} options - CLI options (quick, full, output)
 */
export async function scanCommand(target = null, options = {}) {
    console.log('');
    p.intro(`${chalk.bgMagenta.white(' A11y-Guard Scan ')}`);

    // Pass 1: Load with preliminary mode to read defaultMode from config
    const preliminaryConfig = await loadConfiguration('quick');
    if (!preliminaryConfig) {
        return;
    }

    // Resolve the actual scan mode (CLI flags override config default)
    const scanMode = determineScanMode(options, preliminaryConfig);

    // Pass 2: Reload with correct mode so concurrency ceiling is accurate
    const config = loadConfig(scanMode);

    const resolvedTarget = validateAndResolveTarget(target);
    if (target && resolvedTarget === null) {
        return;
    }

    displayScanConfiguration(config, scanMode, options, target);

    const violations = await executeScan(config, scanMode, resolvedTarget);
    if (violations === null) {
        return;
    }

    outputResults(violations, config, scanMode, options);
    exitIfCritical(violations, options);
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/** Sensible defaults used when no config file exists */
const DEFAULT_CONFIG = {
    selectedStandard: 'wcag-aa',
    rules: { rtl: false, level: 'AA' },
    scan: { defaultMode: 'quick' },
};

/**
 * Load config, running first-time setup automatically if none exists.
 *
 * @param {'quick'|'full'} scanMode - Used to compute safe concurrency ceiling
 * @returns {Promise<Object|null>} - Config object, or null if user cancelled init
 */
async function loadConfiguration(scanMode = 'quick') {
    if (!configExists()) {
        p.log.info(chalk.cyan('No configuration found — starting first-time setup...\n'));
        await initCommand();

        // User may have cancelled init
        if (!configExists()) {
            p.outro(chalk.yellow('Scan cancelled — no configuration available.'));
            return null;
        }
    }

    return loadConfig(scanMode);
}

/**
 * Determine scan mode from CLI options or config default
 *
 * @param {Object} options - CLI options
 * @param {Object} config - User configuration
 * @returns {string} - 'quick' or 'full'
 */
function determineScanMode(options, config) {
    if (options.quick) {
        return 'quick';
    }
    if (options.full) {
        return 'full';
    }
    return config.scan?.defaultMode || 'quick';
}

// -----------------------------------------------------------------------------
// Target Resolution
// -----------------------------------------------------------------------------

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
        p.outro(chalk.yellow('Please provide a valid file or directory path.'));
        return null;
    }

    const stats = fs.statSync(absolutePath);
    const targetType = stats.isDirectory() ? 'Directory' : 'File';
    p.log.info(`Target: ${chalk.cyan(target)} (${targetType})`);

    // Return relative path for cleaner output
    return target;
}

// -----------------------------------------------------------------------------
// Display Helpers
// -----------------------------------------------------------------------------

/**
 * Display current scan configuration
 *
 * @param {Object} config - User configuration
 * @param {string} scanMode - Current scan mode
 * @param {Object} options - CLI options
 * @param {string|null} target - Target path
 */
function displayScanConfiguration(config, scanMode, options, target) {
    const modeDisplay = scanMode === 'full'
        ? chalk.green('Full (with contrast)')
        : chalk.yellow('Quick (no contrast)');

    p.note(
        `Mode: ${modeDisplay}\n` +
        `Standard: ${chalk.bold(config.selectedStandard.toUpperCase())}\n` +
        `RTL Check: ${config.rules.rtl ? chalk.green('Enabled') : chalk.dim('Disabled')}\n` +
        `Output: ${chalk.bold(options.output || 'terminal')}\n` +
        chalk.dim('File types: .html  .jsx  .tsx'),
        'Scan Configuration'
    );
}

// -----------------------------------------------------------------------------
// Scan Execution
// -----------------------------------------------------------------------------

/**
 * Execute the accessibility scan
 *
 * @param {Object} config - User configuration
 * @param {string} scanMode - 'quick' or 'full'
 * @param {string|null} resolvedTarget - Target path to scan
 * @returns {Promise<Array|null>} - Violations array or null on error
 */
async function executeScan(config, scanMode, resolvedTarget) {
    const spinner = p.spinner();
    spinner.start('Analyzing source files...');

    try {
        let violations;

        if (scanMode === 'full') {
            violations = await runFullAudit(config, resolvedTarget);
        } else {
            violations = await runQuickAudit(config, resolvedTarget);
        }

        spinner.stop(chalk.green('Analysis Complete.'));
        return violations;

    } catch (error) {
        spinner.stop(chalk.red('Analysis failed.'));
        handleScanError(error);
        return null;
    }
}

/**
 * Handle scan errors with helpful hints
 *
 * @param {Error} error - The caught error
 */
function handleScanError(error) {
    p.log.error(error.message);

    if (isPlaywrightNotInstalledError(error)) {
        p.log.info(chalk.dim('Hint: Run "npm install playwright @axe-core/playwright" first.'));
    } else if (isBrowserNotInstalledError(error)) {
        p.log.info(chalk.dim('Hint: Run "npx playwright install chromium" to install the browser.'));
    }
}

/**
 * Check if error is due to missing Playwright package
 *
 * @param {Error} error - The caught error
 * @returns {boolean}
 */
function isPlaywrightNotInstalledError(error) {
    return error.message.includes("Cannot find package 'playwright'") ||
        error.message.includes("Cannot find module 'playwright'");
}

/**
 * Check if error is due to missing browser
 *
 * @param {Error} error - The caught error
 * @returns {boolean}
 */
function isBrowserNotInstalledError(error) {
    return error.message.includes("Executable doesn't exist") ||
        error.message.includes('browserType.launch');
}

// -----------------------------------------------------------------------------
// CI Exit Code
// -----------------------------------------------------------------------------

/**
 * Exit with code 1 if --fail-on-critical is set and critical violations exist.
 *
 * @param {Array} violations - All violations from the scan
 * @param {Object} options - CLI options
 */
function exitIfCritical(violations, options) {
    if (!options.failOnCritical) {
        return;
    }

    const hasCritical = violations.some(v => v.impact === 'critical');
    if (hasCritical) {
        process.exit(1);
    }
}
