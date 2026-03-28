/**
 * JSON Outputter
 *
 * Outputs violations as structured JSON — to stdout or to a timestamped file.
 * Used for CI/CD integration and programmatic consumption.
 *
 * @module commands/outputters/jsonOutputter
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import { SCAN_MODES, DEFAULT_REPORT_NAME } from '../../constants.js';
import { formatSummary, countByImpact, countViolationsByFile, formatViolationForJson } from '../../utils/violationFormatter.js';

// -----------------------------------------------------------------------------
// JSON stdout
// -----------------------------------------------------------------------------

/**
 * Output violations as JSON to stdout (for CI/CD)
 *
 * @param {Array} violations - Scan violations
 * @param {Object} config - User configuration
 * @param {string} scanMode - Current scan mode
 * @param {Array} warnings
 */
export function outputJson(violations, config, scanMode, warnings = []) {
    const report = buildJsonReport(violations, config, scanMode, warnings);
    console.log(JSON.stringify(report, null, 2));
}

// -----------------------------------------------------------------------------
// JSON file
// -----------------------------------------------------------------------------

/**
 * Write JSON report to a file
 *
 * @param {Array} violations - Scan violations
 * @param {Object} config - User configuration
 * @param {string} scanMode - Current scan mode
 * @param {string|boolean} filenameOption - Filename or true for auto-generate
 * @param {Array} warnings
 */
export function outputJsonFile(violations, config, scanMode, filenameOption, warnings = []) {
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
// Helpers
// -----------------------------------------------------------------------------

/**
 * Build JSON report structure
 *
 * @param {Array} violations - Scan violations
 * @param {Object} config - User configuration
 * @param {string} scanMode - Current scan mode
 * @param {Array} warnings
 * @returns {Object}
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
        byFile: countViolationsByFile(violations),
        violations: violations.map(formatViolationForJson)
    };
}

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
        return userFilename.endsWith('.json') ? userFilename : `${userFilename}.json`;
    }

    const now = new Date();
    const timestamp = now.toISOString()
        .replace(/[T]/g, '-')
        .replace(/[:.]/g, '')
        .slice(0, 17);

    return `${DEFAULT_REPORT_NAME}-${timestamp}.json`;
}
