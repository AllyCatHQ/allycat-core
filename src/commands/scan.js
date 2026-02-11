import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { CONFIG_FILE_NAME } from '../constants.js';
import { runA11yAudit } from '../engine/scanner.js';

export async function scanCommand() {
    console.log('');
    p.intro(`${chalk.bgMagenta.white(' A11y-Guard Scan ')}`);

    p.log.info(`Scanning directory: ${process.cwd()}`);
    
    const configPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);

    // 1. Check if config exists
    if (!fs.existsSync(configPath)) {
        p.log.error(chalk.red('No configuration found.'));
        p.outro(`Run ${chalk.yellow('a11y-guard init')} first.`);
        return;
    }

    // 2. Load the data (This is where 'config' comes from!)
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // 3. UI: Show the user what we are doing
    p.note(
        `Mode: ${chalk.bold(config.selectedStandard.toUpperCase())}\n` +
        `Framework: ${chalk.bold(config.framework)}\n` +
        `RTL Check: ${config.rules.rtl ? chalk.green('Enabled') : chalk.red('Disabled')}`,
        'Active Configuration'
    );

    const s = p.spinner();
    s.start(`Scanning ${config.framework} files...`);

    try {
        // 4. THE CORE ACTION: Run the audit engine
        const violations = await runA11yAudit(config);
        s.stop(chalk.green('Analysis Complete.'));

        // 5. RESULTS: Loop through the errors found by axe-core
        if (violations.length === 0) {
            p.outro(chalk.green('✔ No accessibility issues found!'));
        } else {
            violations.forEach(v => {
                const impactColor = v.impact === 'critical' ? chalk.red : chalk.yellow;
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