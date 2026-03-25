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
import { generatePrompts } from '../engine/report/promptGenerator.js';
import { generateReport } from '../engine/report/generator.js';
import { openInBrowser } from '../utils/browserOpener.js';

// -----------------------------------------------------------------------------
// Output Routing
// -----------------------------------------------------------------------------

/**
 * Route results to appropriate output handler
 *
 * @param {Array}       violations     - Scan violations
 * @param {Object}      config         - User configuration
 * @param {string}      scanMode       - Current scan mode
 * @param {Object}      options        - CLI options
 * @param {Array}       warnings       - Scan warnings
 * @param {Object|null} baselineResult - Classified violations from baselineManager, or null
 */
export function outputResults(violations, config, scanMode, options, warnings = [], baselineResult = null) {
    if (options.jsonFile) {
        outputJsonFile(violations, config, scanMode, options.jsonFile, warnings);
    } else if (options.output === 'json') {
        outputJson(violations, config, scanMode, warnings);
    } else if (options.summary) {
        outputSummaryOnly(violations, scanMode, warnings);
    } else if (baselineResult) {
        outputTerminalWithBaseline(baselineResult, scanMode);
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
function outputSummaryOnly(violations, scanMode, warnings = []) {
    const summary = formatSummary(violations, scanMode);
    console.log(summary);

    if (violations.length > 0) {
        console.log('');
        console.log(chalk.dim('Use without --summary to see full details.'));
    }

    for (const w of warnings) {
        process.stderr.write(`[WARNING] ${w}\n`);
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

// -----------------------------------------------------------------------------
// Baseline Terminal Output
// -----------------------------------------------------------------------------

/**
 * Output violations to terminal with NEW / BASELINE labels.
 *
 * @param {{ newViolations: Array, baselineViolations: Array, staleCount: number }} baselineResult
 * @param {string} scanMode
 */
function outputTerminalWithBaseline({ newViolations, baselineViolations, staleCount }, scanMode) {
    const allViolations = [
        ...newViolations.map(v => ({ ...v, _baselineStatus: 'NEW' })),
        ...baselineViolations.map(v => ({ ...v, _baselineStatus: 'BASELINE' }))
    ];

    if (allViolations.length === 0) {
        console.log('');
        p.outro(chalk.green('✔ No accessibility issues found!'));
        p.outro(chalk.gray.bold('Developer Tool Only. Limited Scope. Manual verification recommended.'));
        return;
    }

    // Group by file preserving insertion order
    const byFile = allViolations.reduce((acc, v) => {
        if (!acc[v.file]) acc[v.file] = [];
        acc[v.file].push(v);
        return acc;
    }, {});

    const output = [];

    for (const [file, fileViolations] of Object.entries(byFile)) {
        const fileNew  = fileViolations.filter(v => v._baselineStatus === 'NEW').length;
        const fileSup  = fileViolations.filter(v => v._baselineStatus === 'BASELINE').length;

        const countParts = [];
        if (fileNew  > 0) countParts.push(chalk.red(`${fileNew} new`));
        if (fileSup  > 0) countParts.push(chalk.dim(`${fileSup} suppressed`));

        output.push('');
        output.push(chalk.underline.cyan(file));
        output.push(chalk.dim(`${fileViolations.length} issue${fileViolations.length !== 1 ? 's' : ''}`) +
            (countParts.length ? chalk.dim('  (') + countParts.join(chalk.dim(' · ')) + chalk.dim(')') : ''));
        output.push('');

        for (const violation of fileViolations) {
            const isNew = violation._baselineStatus === 'NEW';
            const labelBadge = isNew
                ? chalk.bgRed.white.bold('  NEW      ')
                : chalk.bgGray.white('  BASELINE ');

            output.push(`${labelBadge}  ${formatViolationInline(violation)}`);
            if (!isNew) {
                output.push(chalk.dim('   (suppressed — exists in .a11y-baseline.json)'));
            }
            output.push('');
        }
    }

    console.log(output.join('\n'));

    // Footer summary
    const totalNew = newViolations.length;
    const totalSup = baselineViolations.length;

    if (totalNew > 0) {
        console.log(chalk.red(`✖ ${totalNew} new violation${totalNew !== 1 ? 's' : ''} — pipeline blocked`));
    }
    if (totalSup > 0) {
        console.log(chalk.dim(`✓ ${totalSup} baseline violation${totalSup !== 1 ? 's' : ''} suppressed (run --save-baseline to clean up)`));
    }

    displayTerminalTips(scanMode);
}

/**
 * Format a single violation inline (impact badge + description + rule + file).
 * Used in baseline output where the label badge precedes the normal content.
 *
 * @param {Object} violation
 * @returns {string}
 */
function formatViolationInline(violation) {
    const impactBadges = {
        critical: chalk.bgRed.white.bold(' CRITICAL '),
        serious:  chalk.bgRed.white(' SERIOUS '),
        moderate: chalk.bgYellow.black(' MODERATE '),
        minor:    chalk.bgBlue.white(' MINOR ')
    };
    const impactBadge = impactBadges[violation.impact] || chalk.bgGray.white(` ${(violation.impact || 'unknown').toUpperCase()} `);

    const location = violation.lineNumber
        ? chalk.cyan(`${violation.file}`) + chalk.green(`:${violation.lineNumber}`)
        : chalk.cyan(`${violation.file}`);

    return [
        `${impactBadge}  ${violation.description}`,
        chalk.dim(`   Rule: ${violation.id}`),
        chalk.dim('   File: ') + location,
        violation.selector ? chalk.dim(`   Element: ${violation.selector}`) : '',
        violation.html     ? chalk.dim(`   HTML: ${chalk.yellow(violation.html.substring(0, 80))}`) : ''
    ].filter(Boolean).join('\n');
}

// -----------------------------------------------------------------------------
// Terminal Tips
// -----------------------------------------------------------------------------

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
function outputJson(violations, config, scanMode, warnings = []) {
    const report = buildJsonReport(violations, config, scanMode, warnings);
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
function buildJsonReport(violations, config, scanMode, warnings = []) {
    return {
        timestamp: new Date().toISOString(),
        scanMode: scanMode,
        standard: config.selectedStandard,
        rtlEnabled: config.rules.rtl,
        contrastChecked: scanMode === SCAN_MODES.FULL,
        warnings: warnings,
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
 * generateJsonFilename(true)        // 'allycat-report-2025-02-17-143052.json'
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
function outputJsonFile(violations, config, scanMode, filenameOption, warnings = []) {
    const filename = generateJsonFilename(filenameOption);
    const report = buildJsonReport(violations, config, scanMode, warnings);

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
