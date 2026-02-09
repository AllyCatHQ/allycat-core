#!/usr/bin/env node
import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE_NAME = 'a11y-config.json';

async function main() {
    console.log(''); // שורת רווח
    p.intro(`${chalk.bgBlue.white(' A11y-Guard ')} ${chalk.blue('Let\'s make the web accessible')}`);

    const configPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);

    // בדיקה אם קיים קובץ
    if (fs.existsSync(configPath)) {
        const overwrite = await p.confirm({
            message: 'Configuration already exists. Overwrite it?',
            initialValue: false,
        });

        if (p.isCancel(overwrite) || !overwrite) {
            p.outro(chalk.yellow('Setup cancelled.'));
            process.exit(0);
        }
    }

    // שאלון בעיצוב Vite
    const group = await p.group(
        {
            framework: () => 
                p.select({
                    message: 'Select your project framework:',
                    options: [
                        { value: 'react', label: '⚛️  React' },
                        { value: 'vue', label: '🟢 Vue.js' },
                        { value: 'angular', label: '🅰️  Angular' },
                        { value: 'html', label: '🌐 Vanilla HTML' },
                    ],
                }),
            standard: () => 
                p.select({
                    message: 'Which accessibility standard do you need?',
                    options: [
                        { value: 'israel', label: '🇮🇱 Israeli Standard (AA + RTL)', hint: 'Recommended' },
                        { value: 'wcag-aa', label: '🌍 Global WCAG 2.1 AA' },
                        { value: 'wcag-aaa', label: '🏥 Strict WCAG 2.1 AAA' },
                    ],
                }),
            checkContrast: () => 
                p.confirm({
                    message: 'Check for Color Contrast issues?',
                    initialValue: true,
                }),
            useAI: () => 
                p.confirm({
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

    // עיבוד הלוגיקה
    const config = {
        framework: group.framework,
        standard: group.standard,
        rules: {
            checkContrast: group.checkContrast,
            rtl: group.standard === 'israel',
            level: group.standard === 'wcag-aaa' ? 'AAA' : 'AA'
        },
        ai: { enabled: group.useAI }
    };

    // שמירה
    const s = p.spinner();
    s.start('Saving configuration...');
    
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        s.stop(chalk.green('Configuration saved!'));
        
        p.outro(`Next steps: Run ${chalk.cyan('node index.js scan')} to start.`);
    } catch (e) {
        s.stop(chalk.red('Failed to save configuration.'));
        console.error(e);
    }
}

main().catch(console.error);