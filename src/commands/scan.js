import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { CONFIG_FILE_NAME } from '../constants.js';
import { runA11yAudit } from '../engine/scanner.js';

export async function scanCommand() {
    console.log('');
    p.intro(`${chalk.bgMagenta.white(' A11y-Guard Scan ')}`);

    const configPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);

    if (!fs.existsSync(configPath)) {
        p.log.error(chalk.red('No configuration found.'));
        p.outro(`Run ${chalk.yellow('node index.js init')} first.`);
        return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    p.note(
        `Mode: ${chalk.bold(config.selectedStandard.toUpperCase())}\n` +
        `Framework: ${chalk.bold(config.framework)}\n` +
        `RTL Check: ${config.rules.rtl ? chalk.green('Enabled') : chalk.red('Disabled')}`,
        'Active Configuration'
    );

    const s = p.spinner();
    s.start(`Analyzing source files...`);

    try {
        const violations = await runA11yAudit(config);
        s.stop(chalk.green('Analysis Complete.'));

        if (violations.length === 0) {
            p.outro(chalk.green('✔ No accessibility issues found!'));
        } else {
            console.log(''); // שורת רווח ליופי
            violations.forEach(v => {
                const impactColor = v.impact === 'critical' || v.impact === 'serious' ? chalk.red : chalk.yellow;
                p.log.error(`${impactColor.bold(v.impact.toUpperCase())}: ${v.description}`);
                console.log(chalk.dim(`   File: ${v.file}`));
                console.log(chalk.dim(`   Help: ${v.help}\n`));
            });

            p.outro(chalk.red(`Audit finished. Found ${violations.length} violations.`));
        }
    } catch (error) {
        s.stop(chalk.red('Analysis failed.'));
        p.log.error(error.message);
    }
}