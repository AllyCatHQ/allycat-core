import * as p from '@clack/prompts';
import chalk from 'chalk';
import { configExists, saveConfig } from '../utils/configLoader.js';
import { UI, MESSAGES, SCAN_MODES, STANDARDS, CLI, SUPPORTED_FRAMEWORKS } from '../constants.js';

export async function initCommand() {
    console.log('');
    p.intro(`${chalk.bgBlue.white(UI.INTRO_SETUP)}`);

    // Check if config exists
    if (configExists()) {
        const overwrite = await p.confirm({
            message: 'Configuration already exists. Overwrite it?',
            initialValue: false,
        });
        if (p.isCancel(overwrite) || !overwrite) {
            p.outro(chalk.yellow(MESSAGES.SETUP_CANCELLED));
            return;
        }
    }

    // Configuration questionnaire
    const group = await p.group(
        {
            standard: () => p.select({
                message: 'Which accessibility standard do you need?',
                options: [
                    { value: STANDARDS.WCAG_AA,  label: '🌍 Global Standard (WCAG 2.1 AA)',  hint: 'Industry Standard' },
                    { value: STANDARDS.WCAG_AAA, label: '🏥 Strict Mode (WCAG 2.1 AAA)',      hint: 'Government/Medical' },
                    { value: STANDARDS.ISRAEL,   label: '🇮🇱 Israeli Standard (IS 5568)',      hint: 'AA + RTL Support' },
                ],
            }),
            checkRTL: ({ results }) => results.standard !== STANDARDS.ISRAEL ? p.confirm({
                message: 'Check for RTL support? (For left to right lengusches ex Hebrew, Arabic, Persian)',
                initialValue: false,
            }) : Promise.resolve(true),
            scanMode: () => p.select({
                message: 'Default scan mode:',
                options: [
                    { value: SCAN_MODES.QUICK, label: '⚡ Quick Scan', hint: 'Fast (~1s), no contrast' },
                    { value: SCAN_MODES.FULL,  label: '🔍 Full Scan',  hint: 'Slower (~5s), includes contrast check' },
                ],
            }),
            useAI: () => p.confirm({
                message: 'Enable AI-powered fix suggestions?',
                initialValue: true,
            }),
            aiAgent: ({ results }) => !results.useAI
                ? Promise.resolve('generic')
                : p.select({
                    message: 'Which AI agent do you use?',
                    options: [
                        { value: 'claude',   label: '🟣 Claude',   hint: 'Anthropic — Claude 3/4' },
                        { value: 'cursor',   label: '🔵 Cursor',   hint: 'Cursor IDE AI' },
                        { value: 'chatgpt',  label: '🟢 ChatGPT',  hint: 'OpenAI — GPT-4o' },
                        { value: 'gemini',   label: '🔴 Gemini',   hint: 'Google Gemini' },
                        { value: 'copilot',  label: '⚫ Copilot',  hint: 'GitHub Copilot' },
                        { value: 'generic',  label: '⚪ Other / Skip', hint: 'Generic prompt' },
                    ],
                }),
            advancedOpts: () => p.confirm({
                message: 'Configure advanced options? (concurrency override)',
                initialValue: false,
            }),
            concurrency: ({ results }) => !results.advancedOpts
                ? Promise.resolve('auto')
                : p.select({
                    message: 'Max files scanned in parallel:',
                    options: [
                        { value: 'auto', label: '🔄 Auto (recommended)', hint: 'Detected from your system RAM' },
                        { value: '3',    label: '3 files',               hint: 'Conservative — slow machines or --full scans' },
                        { value: '5',    label: '5 files',               hint: 'Default' },
                        { value: '10',   label: '10 files',              hint: 'For high-RAM machines' },
                    ],
                }),
        },
        {
            onCancel: () => {
                p.outro(chalk.red(MESSAGES.SETUP_ABORTED));
                process.exit(0);
            },
        }
    );

    // Build configuration object
    const config = {
        selectedStandard: group.standard,
        rules: {
            rtl: group.standard === STANDARDS.ISRAEL || group.checkRTL === true,
            level: group.standard === STANDARDS.WCAG_AAA ? 'AAA' : 'AA'
        },
        scan: {
            defaultMode: group.scanMode
        },
        ai: {
            enabled: group.useAI,
            agent: group.aiAgent,
        },
        performance: {
            concurrency: group.concurrency === 'auto' ? null : parseInt(group.concurrency, 10)
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
        `Default Mode: ${chalk.bold(config.scan.defaultMode === SCAN_MODES.FULL ? UI.SCAN_LABEL_FULL : UI.SCAN_LABEL_QUICK_FAST)}\n` +
        `AI Suggestions: ${config.ai.enabled ? chalk.green('Enabled') : chalk.dim('Disabled')}\n` +
        (config.ai.enabled ? `AI Agent:     ${chalk.bold(config.ai.agent)}\n` : '') +
        `Concurrency: ${config.performance.concurrency != null
            ? chalk.bold(config.performance.concurrency) + ' files in parallel'
            : chalk.bold('Auto') + chalk.dim(' (detected from RAM)')}`,
        'Configuration Summary'
    );

    // Show supported file types
    p.note(
        SUPPORTED_FRAMEWORKS.map(f => `${f.extensions.map(e => chalk.cyan(e)).join(', ')} — ${f.label}`).join('\n'),
        'Supported File Types'
    );

    // Show next steps
    const modeHint = config.scan.defaultMode === SCAN_MODES.QUICK
        ? `\nTip: Use ${chalk.cyan(`${CLI.SCAN} --full`)} for contrast checking.`
        : '';

    p.outro(
        `Done! Run ${chalk.cyan(CLI.SCAN)} to audit your code.${modeHint}\n` +
        chalk.dim(`  You can always change your configuration by running `) +
        chalk.yellow(CLI.INIT) +
        chalk.dim(' again.')
    );
}
