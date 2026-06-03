/**
 * Report Outputter
 *
 * Generates the fix-prompt HTML report and delivers it according to the
 * user's configured reportBehavior: auto-open, path-only, or ask each time.
 * Only active in terminal output mode when ai.enabled is true in config.
 *
 * @module commands/outputters/reportOutputter
 */

import path from 'path';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { generateReport } from '../../engine/report/generator.js';
import { openInBrowser } from '../../utils/browserOpener.js';
import { AI_REPORT_BEHAVIORS } from '../../constants.js';

/**
 * Generate the fix-prompt HTML report and deliver it per config.reportBehavior.
 *
 * @param {Array}  violations - All violations
 * @param {Object} config     - User configuration
 * @param {string} scanMode   - 'quick' or 'full'
 */
export async function outputAiReport(violations, config, scanMode) {
    try {
        const behavior = config?.ai?.reportBehavior ?? AI_REPORT_BEHAVIORS.PATH_ONLY;

        if (behavior === AI_REPORT_BEHAVIORS.ASK) {
            const open = await p.confirm({ message: 'Open fix-prompt report in browser?' });
            if (p.isCancel(open)) return;
            if (open) {
                const reportPath = generateReport(violations, config, scanMode);
                openInBrowser(reportPath);
                p.log.success(chalk.green('Fix-prompt report opened: ') + chalk.dim(reportPath));
            } else {
                const reportPath = generateReport(violations, config, scanMode);
                printReportPath(reportPath);
            }
            return;
        }

        const reportPath = generateReport(violations, config, scanMode);

        if (behavior === AI_REPORT_BEHAVIORS.AUTO_OPEN) {
            openInBrowser(reportPath);
            p.log.success(chalk.green('Fix-prompt report opened: ') + chalk.dim(reportPath));
        } else {
            printReportPath(reportPath);
        }
    } catch (error) {
        p.log.warn(chalk.yellow(`Could not generate fix-prompt report: ${error.message}`));
    }
}

function printReportPath(absolutePath) {
    const relativePath = path.relative(process.cwd(), absolutePath);
    p.log.info(
        chalk.green('Fix-prompt report saved → ') +
        chalk.cyan(relativePath) +
        chalk.dim(`  (${absolutePath})`)
    );
}
