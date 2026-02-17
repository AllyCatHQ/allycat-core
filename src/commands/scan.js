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
import { loadConfig } from '../utils/configLoader.js';
import { runQuickAudit } from '../engine/quickScanner.js';
import { formatSummary, formatByFile, countByImpact, groupByFile, formatViolationForJson } from '../utils/violationFormatter.js';
import { runFullAudit } from '../engine/fullScanner.js';

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

    const config = loadConfiguration();
    if (!config) {
        return;
    }

    const scanMode = determineScanMode(options, config);

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
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Load and validate configuration file
 * 
 * @returns {Object|null} - Configuration object or null if not found
 */
function loadConfiguration() {
    const config = loadConfig();

    if (!config) {
        p.log.error(chalk.red('No configuration found.'));
        p.outro(`Run ${chalk.yellow('a11y-guard init')} first.`);
        return null;
    }

    return config;
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
        `Framework: ${chalk.bold(config.framework)}\n` +
        `RTL Check: ${config.rules.rtl ? chalk.green('Enabled') : chalk.dim('Disabled')}\n` +
        `Output: ${chalk.bold(options.output || 'terminal')}`,
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
// Output Routing
// -----------------------------------------------------------------------------

/**
 * Route results to appropriate output handler
 * 
 * @param {Array} violations - Scan violations
 * @param {Object} config - User configuration
 * @param {string} scanMode - Current scan mode
 * @param {Object} options - CLI options
 */
function outputResults(violations, config, scanMode, options) {
    if (options.output === 'json') {
        outputJson(violations, config, scanMode);
    } else if (options.summary) {
        outputSummaryOnly(violations, scanMode);
    } else {
        outputTerminal(violations, scanMode);
    }
}

/**
 * Output only violation counts (no details)
 * 
 * Provides a minimal output for quick checks and CI logs.
 * 
 * @param {Array} violations - Scan violations
 * @param {string} scanMode - Current scan mode
 */
function outputSummaryOnly(violations, scanMode) {
    const summary = formatSummary(violations, scanMode);
    console.log(summary);
    
    if (violations.length > 0) {
        console.log('');
        console.log(chalk.dim('Use without --summary to see full details.'));
    }
    
    console.log('');
}

// -----------------------------------------------------------------------------
// Terminal Output
// -----------------------------------------------------------------------------

/**
 * Output violations to terminal with enhanced formatting
 * 
 * @param {Array} violations - Scan violations
 * @param {string} scanMode - Current scan mode
 */
function outputTerminal(violations, scanMode) {
    if (violations.length === 0) {
        console.log('');
        p.outro(chalk.green('✔ No accessibility issues found!'));
        p.outro(chalk.gray.bold('Developer Tool Only. Limited Scope. Manual verification recommended.'));
        return;
    }

    const formattedOutput = formatByFile(violations, {
        showSnippet: true,
        showSelector: true
    });
    console.log(formattedOutput);

    const summary = formatSummary(violations, scanMode);
    console.log(summary);

    displayTerminalTips(scanMode);
}

/**
 * Display helpful tips after terminal output
 * 
 * @param {string} scanMode - Current scan mode
 */
function displayTerminalTips(scanMode) {
    console.log('');
    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.dim('Tips:'));
    console.log(chalk.dim('  • File paths with line numbers are clickable in VS Code'));
    console.log(chalk.dim('  • Use --output json for CI/CD integration'));

    if (scanMode === 'quick') {
        console.log(chalk.dim('  • Use --full to enable contrast checking'));
    }

    console.log('');
}

// -----------------------------------------------------------------------------
// JSON Output
// -----------------------------------------------------------------------------

/**
 * Output violations as JSON (for CI/CD)
 * 
 * @param {Array} violations - Scan violations
 * @param {Object} config - User configuration
 * @param {string} scanMode - Current scan mode
 */
function outputJson(violations, config, scanMode) {
    const report = buildJsonReport(violations, config, scanMode);
    console.log(JSON.stringify(report, null, 2));
}

/**
 * Build JSON report structure
 * 
 * @param {Array} violations - Scan violations
 * @param {Object} config - User configuration
 * @param {string} scanMode - Current scan mode
 * @returns {Object} - Complete JSON report
 */
function buildJsonReport(violations, config, scanMode) {
    return {
        timestamp: new Date().toISOString(),
        scanMode: scanMode,
        standard: config.selectedStandard,
        rtlEnabled: config.rules.rtl,
        contrastChecked: scanMode === 'full',
        totalViolations: violations.length,
        summary: countByImpact(violations),
        byFile: groupByFile(violations),
        violations: violations.map(formatViolationForJson)
    };
}