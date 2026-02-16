/**
 * Scan Command
 * 
 * Orchestrates accessibility scanning with quick/full modes.
 * Outputs violations with precise location data.
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { CONFIG_FILE_NAME } from '../constants.js';
import { runQuickAudit } from '../engine/quickScanner.js';
import { formatViolation, formatSummary, formatByFile } from '../utils/violationFormatter.js';

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

    // Determine scan mode: CLI flag > config default
    let scanMode;
    if (options.quick) {
        scanMode = 'quick';
    } else if (options.full) {
        scanMode = 'full';
    } else {
        scanMode = config.scan?.defaultMode || 'quick';
    }

    // Validate target path if provided
    let resolvedTarget = null;
if (target) {
    const absolutePath = path.resolve(process.cwd(), target);
    if (!fs.existsSync(absolutePath)) {
        p.log.error(chalk.red(`Target path not found: ${target}`));
        p.outro(chalk.yellow('Please provide a valid file or directory path.'));
        return;
    }
    // Keep relative path for cleaner output
    resolvedTarget = target;
        const stats = fs.statSync(resolvedTarget);
        const targetType = stats.isDirectory() ? 'Directory' : 'File';
        p.log.info(`Target: ${chalk.cyan(target)} (${targetType})`);
    }

    // Show active configuration
    const modeDisplay = scanMode === 'full' 
        ? chalk.green('Full (with contrast)') 
        : chalk.yellow('Quick (no contrast)');

    p.note(
        `Mode: ${modeDisplay}\n` +
        `Standard: ${chalk.bold(config.selectedStandard.toUpperCase())}\n` +
        `Framework: ${chalk.bold(config.framework)}\n` +
        `RTL Check: ${config.rules.rtl ? chalk.green('Enabled') : chalk.dim('Disabled')}\n` +
        `Output: ${chalk.bold(options.output || 'terminal')}`,
        'Scan Configuration'
    );

    const s = p.spinner();
    s.start('Analyzing source files...');

    try {
        let violations;

        if (scanMode === 'full') {
            const { runFullAudit } = await import('../engine/fullScanner.js');
            violations = await runFullAudit(config, resolvedTarget);
        } else {
            violations = await runQuickAudit(config, resolvedTarget);
        }

        s.stop(chalk.green('Analysis Complete.'));

        // Handle output format
        if (options.output === 'json') {
            outputJson(violations, config, scanMode);
        } else {
            outputTerminal(violations, scanMode, options);
        }
    } catch (error) {
        s.stop(chalk.red('Analysis failed.'));
        p.log.error(error.message);
        
        if (error.message.includes("Cannot find package 'playwright'") || 
            error.message.includes("Cannot find module 'playwright'")) {
            p.log.info(chalk.dim('Hint: Run "npm install playwright @axe-core/playwright" first.'));
        } else if (error.message.includes('Executable doesn\'t exist') || 
                   error.message.includes('browserType.launch')) {
            p.log.info(chalk.dim('Hint: Run "npx playwright install chromium" to install the browser.'));
        }
    }
}

/**
 * Output violations to terminal with enhanced formatting
 */
function outputTerminal(violations, scanMode, options = {}) {
    if (violations.length === 0) {
        console.log('');
        p.outro(chalk.green('✔ No accessibility issues found!'));
        return;
    }

    // Group by file for better readability
    const output = formatByFile(violations, {
        showSnippet: true,
        showSelector: true
    });
    
    console.log(output);
    
    // Summary
    const summary = formatSummary(violations, scanMode);
    console.log(summary);
    
    // Tips
    console.log('');
    console.log(chalk.dim('─'.repeat(60)));
    console.log(chalk.dim('Tips:'));
    console.log(chalk.dim('  • File paths with line numbers are clickable in VS Code'));
    console.log(chalk.dim('  • Use --output json for CI/CD integration'));
    if (scanMode === 'quick') {
        console.log(chalk.dim('  • Use --full to enable contrast checking'));
    }
    console.log('');
}

/**
 * Output violations as JSON (for CI/CD)
 */
function outputJson(violations, config, scanMode) {
    const report = {
        timestamp: new Date().toISOString(),
        scanMode: scanMode,
        standard: config.selectedStandard,
        rtlEnabled: config.rules.rtl,
        contrastChecked: scanMode === 'full',
        totalViolations: violations.length,
        summary: {
            critical: violations.filter(v => v.impact === 'critical').length,
            serious: violations.filter(v => v.impact === 'serious').length,
            moderate: violations.filter(v => v.impact === 'moderate').length,
            minor: violations.filter(v => v.impact === 'minor').length,
        },
        byFile: groupByFile(violations),
        violations: violations.map(v => ({
            file: v.file,
            line: v.lineNumber,
            rule: v.id,
            impact: v.impact,
            description: v.description,
            help: v.help,
            helpUrl: v.helpUrl,
            wcag: v.wcagTags,
            element: {
                selector: v.selector,
                html: v.html
            },
            ...(v.contrastData && { contrast: v.contrastData })
        }))
    };
    
    console.log(JSON.stringify(report, null, 2));
}

/**
 * Group violations by file for JSON output
 */
function groupByFile(violations) {
    return violations.reduce((acc, v) => {
        if (!acc[v.file]) {
            acc[v.file] = { count: 0, critical: 0, serious: 0 };
        }
        acc[v.file].count++;
        if (v.impact === 'critical') acc[v.file].critical++;
        if (v.impact === 'serious') acc[v.file].serious++;
        return acc;
    }, {});
}