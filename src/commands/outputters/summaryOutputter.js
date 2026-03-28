/**
 * Summary Outputter
 *
 * Outputs only violation counts — no per-violation details.
 * Used with the --summary flag for quick CI checks and minimal logs.
 *
 * @module commands/outputters/summaryOutputter
 */

import chalk from 'chalk';
import { formatSummary } from '../../utils/violationFormatter.js';

/**
 * Output only violation counts (no details)
 *
 * @param {Array} violations - Scan violations
 * @param {string} scanMode - Current scan mode
 * @param {Array} warnings
 */
export function outputSummaryOnly(violations, scanMode, warnings = []) {
    const summary = formatSummary(violations, scanMode);
    console.log(summary);

    if (violations.length > 0) {
        console.log('');
        console.log(chalk.dim('Use without --summary to see full details.'));
    }

    for (const w of warnings) {
        process.stderr.write(chalk.yellow(`⚠ [allycat] ${w}\n`));
    }

    console.log('');
}
