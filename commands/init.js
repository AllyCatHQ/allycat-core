import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { CONFIG_FILE_NAME } from '../constants.js';

export async function initCommand() {
    console.log('');
    p.intro(`${chalk.bgBlue.white(' A11y-Guard Setup ')}`);

    const configPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);

    // Check if config exists
    if (fs.existsSync(configPath)) {
        const overwrite = await p.confirm({
            message: 'Configuration already exists. Overwrite it?',
            initialValue: false,
        });
        if (p.isCancel(overwrite) || !overwrite) {
            p.outro(chalk.yellow('Setup cancelled.'));
            return;
        }
    }

    // The full original questionnaire
    const group = await p.group(
        {
            framework: () => p.select({
                message: 'Select your project framework:',
                options: [
                    { value: 'react', label: '⚛️  React (JSX/TSX)' },
                    { value: 'vue', label: '🟢 Vue.js' },
                    { value: 'angular', label: '🅰️  Angular' },
                    { value: 'html', label: '🌐 Vanilla HTML/JS' },
                ],
            }),
            standard: () => p.select({
                message: 'Which accessibility standard do you need?',
                options: [
                    { value: 'israel', label: '🇮🇱 Israeli Standard (IS 5568)', hint: 'AA + RTL Support' },
                    { value: 'wcag-aa', label: '🌍 Global Standard (WCAG 2.1 AA)', hint: 'Industry Standard' },
                    { value: 'wcag-aaa', label: '🏥 Strict Mode (WCAG 2.1 AAA)', hint: 'Government/Medical' },
                ],
            }),
            checkContrast: () => p.confirm({
                message: 'Check for Color Contrast issues?',
                initialValue: true,
            }),
            useAI: () => p.confirm({
                message: 'Enable AI-powered auto-fix suggestions?',
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

    // Logic to translate choices into technical rules
    const config = {
        framework: group.framework,
        selectedStandard: group.standard,
        rules: {
            checkContrast: group.checkContrast,
            rtl: group.standard === 'israel',
            level: group.standard === 'wcag-aaa' ? 'AAA' : 'AA'
        },
        ai: {
            enabled: group.useAI
        }
    };

    const s = p.spinner();
    s.start('Generating your config file...');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    s.stop(chalk.green('Configuration saved successfully!'));

    p.outro(`Done! Now run ${chalk.cyan('node index.js scan')} to audit your code.`);
}