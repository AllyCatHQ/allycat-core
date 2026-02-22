import * as p from '@clack/prompts';
import chalk from 'chalk';
import { configExists, saveConfig, getConfigPath } from '../utils/configLoader.js';

export async function initCommand() {
    console.log('');
    p.intro(`${chalk.bgBlue.white(' A11y-Guard Setup ')}`);

    // Check if config exists
    if (configExists()) {
        const overwrite = await p.confirm({
            message: 'Configuration already exists. Overwrite it?',
            initialValue: false,
        });
        if (p.isCancel(overwrite) || !overwrite) {
            p.outro(chalk.yellow('Setup cancelled.'));
            return;
        }
    }

    // Configuration questionnaire
    const group = await p.group(
        {
            standard: () => p.select({
                message: 'Which accessibility standard do you need?',
                options: [
                    { value: 'wcag-aa', label: '🌍 Global Standard (WCAG 2.1 AA)', hint: 'Industry Standard' },
                    { value: 'wcag-aaa', label: '🏥 Strict Mode (WCAG 2.1 AAA)', hint: 'Government/Medical' },
                    { value: 'israel', label: '🇮🇱 Israeli Standard (IS 5568)', hint: 'AA + RTL Support' },
                ],
            }),
            checkRTL: ({ results }) => results.standard !== 'israel' ? p.confirm({
                message: 'Check for RTL support? (For left to right lengusches ex Hebrew, Arabic, Persian)',
                initialValue: false,
            }) : Promise.resolve(true),
            scanMode: () => p.select({
                message: 'Default scan mode:',
                options: [
                    { value: 'quick', label: '⚡ Quick Scan', hint: 'Fast (~1s), no contrast' },
                    { value: 'full', label: '🔍 Full Scan', hint: 'Slower (~5s), includes contrast check' },
                ],
            }),
            useAI: () => p.confirm({
                message: 'Enable AI-powered fix suggestions?',
                initialValue: true,
            }),
        },
        {
            onCancel: () => {
                p.outro(chalk.red('Setup aborted.'));
                process.exit(0);
            },
        }
    );

    // Build configuration object
    const config = {
        selectedStandard: group.standard,
        rules: {
            rtl: group.standard === 'israel' || group.checkRTL === true,
            level: group.standard === 'wcag-aaa' ? 'AAA' : 'AA'
        },
        scan: {
            defaultMode: group.scanMode
        },
        ai: {
            enabled: group.useAI
        }
    };

    // Save configuration
    const s = p.spinner();
    s.start('Generating your config file...');
    saveConfig(config);
    s.stop(chalk.green('Configuration saved successfully!'));

    // Show summary
    p.note(
        `Standard: ${chalk.bold(config.selectedStandard.toUpperCase())}\n` +
        `RTL Check: ${config.rules.rtl ? chalk.green('Enabled') : chalk.dim('Disabled')}\n` +
        `Default Mode: ${chalk.bold(config.scan.defaultMode === 'full' ? 'Full (with contrast)' : 'Quick (fast)')}\n` +
        `AI Suggestions: ${config.ai.enabled ? chalk.green('Enabled') : chalk.dim('Disabled')}`,
        'Configuration Summary'
    );

    // Show next steps
    const modeHint = config.scan.defaultMode === 'quick'
        ? `\nTip: Use ${chalk.cyan('a11y-guard scan --full')} for contrast checking.`
        : '';

    p.outro(
    `Done! Run ${chalk.cyan('a11y-guard scan')} to audit your code.${modeHint}\n` +
    chalk.dim(`  You can always change your configuration by running `) +
    chalk.yellow('a11y-guard init') +
    chalk.dim(' again.')
);
}