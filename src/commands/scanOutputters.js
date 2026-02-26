/**
 * Scan Outputters
 *
 * All output handlers for the scan command.
 * Routes violations to terminal, JSON, JSON-file, summary, or AI report
 * depending on CLI options.
 *
 * @module commands/scanOutputters
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import { UI, SCAN_MODES, DEFAULT_REPORT_NAME } from '../constants.js';
import { formatSummary, formatByFile, countByImpact, groupByFile, formatViolationForJson } from '../utils/violationFormatter.js';
import { generatePrompts } from '../engine/promptGenerator.js';
import { generateReport } from '../engine/reportGenerator.js';
import { openInBrowser } from '../utils/browserOpener.js';

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
export function outputResults(violations, config, scanMode, options) {
    if (options.jsonFile) {
        outputJsonFile(violations, config, scanMode, options.jsonFile);
    } else if (options.output === 'json') {
        outputJson(violations, config, scanMode);
    } else if (options.summary) {
        outputSummaryOnly(violations, scanMode);
    } else {
        outputTerminal(violations, scanMode);
    }
    // AI report: terminal mode only — not in json, json-file, or summary modes
    if (!options.jsonFile && options.output !== 'json' && !options.summary) {
        // outputPrompts(violations, config);
        if (config?.ai?.enabled && violations.length > 0) {
            outputAiReport(violations, config, scanMode);
        }
    }
}

// -----------------------------------------------------------------------------
// Summary Output
// -----------------------------------------------------------------------------

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
    console.log(chalk.dim(UI.DIVIDER));
    console.log(chalk.dim('Tips:'));
    console.log(chalk.dim('  • File paths with line numbers are clickable in VS Code'));
    console.log(chalk.dim('  • Use --output json for CI/CD integration'));

    if (scanMode === SCAN_MODES.QUICK) {
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
        contrastChecked: scanMode === SCAN_MODES.FULL,
        totalViolations: violations.length,
        summary: countByImpact(violations),
        byFile: groupByFile(violations),
        violations: violations.map(formatViolationForJson)
    };
}

// -----------------------------------------------------------------------------
// JSON File Output
// -----------------------------------------------------------------------------

/**
 * Generate timestamped filename for JSON report
 *
 * @param {string|boolean} userFilename - User-provided filename or true for auto-generate
 * @returns {string} - Complete filename with .json extension
 *
 * @example
 * generateJsonFilename(true)        // 'a11y-report-2025-02-17-143052.json'
 * generateJsonFilename('my-report') // 'my-report.json'
 */
function generateJsonFilename(userFilename) {
    if (typeof userFilename === 'string' && userFilename.length > 0) {
        // User provided a name — ensure .json extension
        return userFilename.endsWith('.json') ? userFilename : `${userFilename}.json`;
    }

    // Auto-generate with timestamp
    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[T]/g, '-')
        .replace(/[:.]/g, '')
        .slice(0, 17);

    return `${DEFAULT_REPORT_NAME}-${timestamp}.json`;
}

/**
 * Write JSON report to file
 *
 * @param {Array} violations - Scan violations
 * @param {Object} config - User configuration
 * @param {string} scanMode - Current scan mode
 * @param {string|boolean} filenameOption - Filename or true for auto-generate
 */
function outputJsonFile(violations, config, scanMode, filenameOption) {
    const filename = generateJsonFilename(filenameOption);
    const report = buildJsonReport(violations, config, scanMode);

    fs.writeFileSync(filename, JSON.stringify(report, null, 2));

    p.log.success(chalk.green(`Report saved: ${chalk.bold(filename)}`));

    // Also show summary in terminal
    const summary = formatSummary(violations, scanMode);
    console.log(summary);
    console.log('');
}

// -----------------------------------------------------------------------------
// AI Prompt Output
// -----------------------------------------------------------------------------

/**
 * Display AI fix prompts grouped by file.
 *
 * Only shown when:
 *  - config.ai.enabled is true
 *  - violations exist
 *  - output mode is terminal (not json, not summary)
 *
 * @param {Array} violations - All violations from the scan
 * @param {Object} config    - User configuration
 */
function outputPrompts(violations, config) {
    if (!config?.ai?.enabled) return;
    if (violations.length === 0) return;

    const prompts = generatePrompts(violations, config);
    if (prompts.length === 0) return;

    console.log('');
    console.log(chalk.dim(UI.DIVIDER));
    console.log(chalk.bold.magenta('  ✦ AI Fix Prompts'));
    console.log(chalk.dim('  Copy the prompt for each file and paste into your AI agent.'));
    console.log(chalk.dim(UI.DIVIDER));

    for (const { file, prompt } of prompts) {
        console.log('');
        console.log(chalk.bold.cyan(`  ▸ ${file}`));
        console.log('');
        console.log(chalk.dim('  ┌─ Copy everything between the lines ──────────────────'));
        console.log('');

        prompt.split('\n').forEach(line => {
            console.log(`  ${line}`);
        });

        console.log('');
        console.log(chalk.dim('  └──────────────────────────────────────────────────────'));
    }

    console.log('');
}

/**
 * Generate HTML report and open it in the browser.
 *
 * @param {Array} violations - All violations
 * @param {Object} config    - User configuration
 * @param {string} scanMode  - 'quick' or 'full'
 */
function outputAiReport(violations, config, scanMode) {
    try {
        const reportPath = generateReport(violations, config, scanMode);
        openInBrowser(reportPath);
        p.log.success(
            chalk.green('AI report opened in browser: ') +
            chalk.dim(reportPath)
        );
    } catch (error) {
        p.log.warn(chalk.yellow(`Could not generate AI report: ${error.message}`));
    }
}
