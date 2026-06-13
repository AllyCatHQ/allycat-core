import chalk from 'chalk';
import { APP_LINKS } from '../constants.js';
import { openInBrowser } from '../utils/browserOpener.js';

export function repoCommand() {
    console.log(chalk.dim('Opening GitHub repository: ') + chalk.cyan(APP_LINKS.REPO));
    openInBrowser(APP_LINKS.REPO);
}
