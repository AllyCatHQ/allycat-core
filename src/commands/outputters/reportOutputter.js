/**
 * Report Outputter
 *
 * Generates and opens the AI-assisted HTML report in the default browser.
 * Only active in terminal output mode when ai.enabled is true in config.
 *
 * @module commands/outputters/reportOutputter
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';
import { generateReport } from '../../engine/report/generator.js';
import { openInBrowser } from '../../utils/browserOpener.js';

/**
 * Generate HTML report and open it in the browser.
 *
 * @param {Array} violations - All violations
 * @param {Object} config    - User configuration
 * @param {string} scanMode  - 'quick' or 'full'
 */
export function outputAiReport(violations, config, scanMode) {
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
