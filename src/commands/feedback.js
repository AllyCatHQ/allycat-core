import chalk from 'chalk';
import { APP_LINKS } from '../constants.js';
import { openInBrowser } from '../utils/browserOpener.js';

export function feedbackCommand() {
    console.log(chalk.dim('Opening GitHub Issues: ') + chalk.cyan(APP_LINKS.ISSUES));
    openInBrowser(APP_LINKS.ISSUES);
}
