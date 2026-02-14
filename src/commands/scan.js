import * as p from '@clack/prompts';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { CONFIG_FILE_NAME } from '../constants.js';
import { runQuickAudit } from '../engine/quickScanner.js';

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
            // Full scan with Playwright (includes contrast)
            const { runFullAudit } = await import('../engine/fullScanner.js');
            violations = await runFullAudit(config, resolvedTarget);
        } else {
            // Quick scan with JSDOM (no contrast)
            violations = await runQuickAudit(config, resolvedTarget);
        }

        s.stop(chalk.green('Analysis Complete.'));

        // Handle output format
        if (options.output === 'json') {
            outputJson(violations, config, scanMode);
        } else {
            outputTerminal(violations, scanMode);
        }
    } catch (error) {
        s.stop(chalk.red('Analysis failed.'));
        p.log.error(error.message);
        
        // Helpful hints for different Playwright errors
        if (error.message.includes("Cannot find package 'playwright'") || 
            error.message.includes("Cannot find module 'playwright'")) {
            p.log.info(chalk.dim('Hint: Run "npm install playwright @axe-core/playwright" first.'));
        } else if (error.message.includes('Executable doesn\'t exist') || 
                   error.message.includes('browserType.launch')) {
            p.log.info(chalk.dim('Hint: Run "npx playwright install chromium" to install the browser.'));
        } else if (error.message.includes('newContext')) {
            p.log.info(chalk.dim('Hint: This is a Playwright API issue. Please report this bug.'));
        }
    }
}

/**
 * Output violations to terminal with colors
 */
function outputTerminal(violations, scanMode) {
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
        console.log(chalk.cyan(`   File: ${v.file}`));
        console.log(chalk.dim(`   Help: ${v.help}`));
        
        if (v.wcagTags && v.wcagTags.length > 0) {
            console.log(chalk.dim(`   WCAG: ${v.wcagTags.join(', ')}`));
        }

        // Show element count if more than 1
        if (v.nodeCount && v.nodeCount > 1) {
            console.log(chalk.dim(`   Elements: ${v.nodeCount} affected`));
        }

        // Show contrast details if available
        if (v.contrastData) {
            const cd = v.contrastData;
            if (cd.contrastRatio) {
                console.log(chalk.dim(`   Contrast: ${cd.contrastRatio.toFixed(2)}:1 (needs ${cd.expectedRatio})`));
            }
        }

        console.log('');
    });

    // Summary with mode indicator
    const modeNote = scanMode === 'quick' 
        ? chalk.dim(' (use --full for contrast checking)')
        : '';
    
    p.outro(chalk.red(`Found ${violations.length} violations.${modeNote}`));
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
        violations: violations
    };
    
    // Output raw JSON (no colors, no formatting from clack)
    console.log(JSON.stringify(report, null, 2));
}