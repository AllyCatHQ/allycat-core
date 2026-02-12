import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { CONFIG_FILE_NAME } from '../constants.js';
import { runA11yAudit } from '../engine/scanner.js';

export async function scanCommand(target = null, options = {}) {
    console.log('');
    p.intro(`${chalk.bgMagenta.white(' A11y-Guard Scan ')}`);

    const configPath = path.resolve(process.cwd(), CONFIG_FILE_NAME);

    if (!fs.existsSync(configPath)) {
        p.log.error(chalk.red('No configuration found.'));
        p.outro(`Run ${chalk.yellow('a11y-guard init')} first.`);
        return;
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

    // Validate target path if provided
    let resolvedTarget = null;
    if (target) {
        resolvedTarget = path.resolve(process.cwd(), target);
        if (!fs.existsSync(resolvedTarget)) {
            p.log.error(chalk.red(`Target path not found: ${target}`));
            p.outro(chalk.yellow('Please provide a valid file or directory path.'));
            return;
        }
        const stats = fs.statSync(resolvedTarget);
        const targetType = stats.isDirectory() ? 'Directory' : 'File';
        p.log.info(`Target: ${chalk.cyan(target)} (${targetType})`);
    }

    p.note(
        `Mode: ${chalk.bold(config.selectedStandard.toUpperCase())}\n` +
        `Framework: ${chalk.bold(config.framework)}\n` +
        `RTL Check: ${config.rules.rtl ? chalk.green('Enabled') : chalk.red('Disabled')}\n` +
        `Output: ${chalk.bold(options.output || 'terminal')}`,
        'Active Configuration'
    );

    const s = p.spinner();
    s.start('Analyzing source files...');

    try {
        const violations = await runA11yAudit(config, resolvedTarget);
        s.stop(chalk.green('Analysis Complete.'));

        // Handle output format
        if (options.output === 'json') {
            outputJson(violations, config);
        } else {
            outputTerminal(violations);
        }
    } catch (error) {
        s.stop(chalk.red('Analysis failed.'));
        p.log.error(error.message);
    }
}

/**
 * Output violations to terminal with colors
 */
function outputTerminal(violations) {
    if (violations.length === 0) {
        p.outro(chalk.green('✔ No accessibility issues found!'));
        return;
    }

    console.log('');
    violations.forEach(v => {
        const impactColor = v.impact === 'critical' || v.impact === 'serious' 
            ? chalk.red 
            : chalk.yellow;
        
        p.log.error(`${impactColor.bold(v.impact.toUpperCase())}: ${v.description}`);
        console.log(chalk.dim(`   Rule: ${v.id}`));
        console.log(chalk.dim(`   File: ${v.file}`));
        console.log(chalk.dim(`   Help: ${v.help}`));
        
        if (v.wcagTags && v.wcagTags.length > 0) {
            console.log(chalk.dim(`   WCAG: ${v.wcagTags.join(', ')}`));
        }
        console.log('');
    });

    p.outro(chalk.red(`Audit finished. Found ${violations.length} violations.`));
}

/**
 * Output violations as JSON (for CI/CD)
 */
function outputJson(violations, config) {
    const report = {
        timestamp: new Date().toISOString(),
        standard: config.selectedStandard,
        rtlEnabled: config.rules.rtl,
        totalViolations: violations.length,
        summary: {
            critical: violations.filter(v => v.impact === 'critical').length,
            serious: violations.filter(v => v.impact === 'serious').length,
            moderate: violations.filter(v => v.impact === 'moderate').length,
            minor: violations.filter(v => v.impact === 'minor').length,
        },
        violations: violations
    };
    
    // Output raw JSON (no colors, no formatting from clack)
    console.log(JSON.stringify(report, null, 2));
}