import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { DEFAULT_HTML_REPORT } from '../constants.js';
import { openInBrowser } from '../utils/browserOpener.js';

export function reportCommand() {
    const reportPath = path.join(process.cwd(), DEFAULT_HTML_REPORT);

    if (!fs.existsSync(reportPath)) {
        console.log(chalk.yellow('No report found.') + ' Run ' + chalk.cyan('allycat scan') + ' first to generate one.');
        return;
    }

    console.log(chalk.dim('Opening report: ') + chalk.cyan(reportPath));
    openInBrowser(reportPath);
}
