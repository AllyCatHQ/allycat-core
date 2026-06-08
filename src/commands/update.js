import * as p from '@clack/prompts';
import chalk from 'chalk';
import { createRequire } from 'module';
import { APP_LINKS } from '../constants.js';
import { openInBrowser } from '../utils/browserOpener.js';

const require = createRequire(import.meta.url);
const pkg = require('../../package.json');

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

function semverIsNewer(a, b) {
    if (!SEMVER_RE.test(a) || !SEMVER_RE.test(b)) return false;
    const parse = v => v.split('.').map(Number);
    const [am, an, ap] = parse(a);
    const [bm, bn, bp] = parse(b);
    if (am !== bm) return am > bm;
    if (an !== bn) return an > bn;
    return ap > bp;
}

export async function updateCommand() {
    const localVersion = pkg.version;

    p.intro(chalk.bold(' 🐾 AllyCat Update '));

    const s = p.spinner();
    s.start('Checking for updates...');

    let latestVersion;
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch('https://registry.npmjs.org/allycat/latest', { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (typeof data.version !== 'string' || !data.version) throw new Error('Invalid version in registry response');
        latestVersion = data.version;
        s.stop('Done');
    } catch {
        s.stop('');
        p.log.error('Could not reach the npm registry. Check your internet connection.');
        process.exit(1);
    }

    const updateAvailable = semverIsNewer(latestVersion, localVersion);

    if (updateAvailable) {
        p.log.warn(`Update available: ${chalk.dim(`v${localVersion}`)} → ${chalk.green(`v${latestVersion}`)}`);
    } else {
        p.log.success(`You're up to date! ${chalk.dim(`(v${localVersion})`)}`);
    }

    const displayVersion = updateAvailable ? latestVersion : localVersion;

    const choice = await p.select({
        message: 'What would you like to do?',
        options: [
            ...(updateAvailable
                ? [{ value: 'update', label: `Update to v${latestVersion}`, hint: 'Shows the command to run' }]
                : []),
            { value: 'whats-new',      label: `What's new in v${displayVersion}`, hint: 'Opens GitHub release notes' },
            { value: 'full-changelog', label: 'See full changelog',                hint: 'Opens CHANGELOG.md on GitHub' },
            { value: 'exit',           label: 'Exit' },
        ],
    });

    if (p.isCancel(choice) || choice === 'exit') {
        p.outro(chalk.dim('Bye!'));
        return;
    }

    if (choice === 'update') {
        console.log('');
        console.log(`  ${chalk.bold('To update, run one of:')}`);
        console.log(`  ${chalk.cyan('npm install -g allycat@latest')}    ${chalk.dim('# global install')}`);
        console.log(`  ${chalk.cyan('npm install allycat@latest')}       ${chalk.dim('# local project install')}`);
        console.log('');
        p.outro(chalk.dim('Bye!'));
        return;
    }

    if (choice === 'whats-new') {
        const url = APP_LINKS.RELEASE(displayVersion);
        p.log.step(`Opening release notes for v${displayVersion}...`);
        console.log(chalk.dim(`  ${url}`));
        openInBrowser(url);
    }

    if (choice === 'full-changelog') {
        p.log.step('Opening full changelog...');
        console.log(chalk.dim(`  ${APP_LINKS.CHANGELOG}`));
        openInBrowser(APP_LINKS.CHANGELOG);
    }

    p.outro(chalk.dim('Bye!'));
}
