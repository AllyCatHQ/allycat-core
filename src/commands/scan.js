/**
 * Scan Command
 *
 * Thin orchestrator: config loading → input resolution → scan execution → result handling.
 * Business logic lives in scanDispatcher.js and scanResultHandler.js.
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';
import { loadConfig } from '../utils/configLoader.js';
import { watchMode } from './watchMode.js';
import { resolveInputFiles, executeScan, preflightScan } from './scanDispatcher.js';
import { handleScanResult } from './scanResultHandler.js';
import { SUPPORTED_EXTENSIONS_DISPLAY, MESSAGES, UI, SCAN_MODES, getStandardLabel } from '../constants.js';
import { expandUserPath } from '../utils/pathUtils.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Main scan command entry point
 *
 * @param {string|null} target - Optional file/folder path to scan
 * @param {Object} options - CLI options (quick, full, output)
 */
export async function scanCommand(target = null, options = {}) {
    console.log('');
    p.intro(`${chalk.bgMagenta.white(UI.INTRO_SCAN)}`);

    if (target) target = expandUserPath(target);

    // --ci preset: expand into constituent flags before any other code reads options
    if (options.ci) {
        options.snippet       = false;
        options.help          = false;
        options.wcag          = false;
        options.selector      = false;
        options.affected      = false;
        options.tips          = false;
        options.summaryStyle  = 'compact';
        options.failOnCritical = true;
    }

    // Pass 1: Load with quick mode to read defaultMode; concurrency is re-clamped in pass 2.
    const preliminaryConfig = loadConfig(SCAN_MODES.QUICK);

    if (preliminaryConfig.configIsDefault) {
        p.log.info(chalk.cyan(MESSAGES.USING_DEFAULT_CONFIG));
    }

    // Resolve the actual scan mode (CLI flags override config default)
    const scanMode = determineScanMode(options, preliminaryConfig);

    // Pass 2: Reload with correct mode so concurrency ceiling is accurate
    const config = loadConfig(scanMode);

    // Watch mode: delegate entirely — does not return to the normal scan path
    if (options.watch) {
        await watchMode(target, config, scanMode, options);
        return;
    }

    // Fail fast: check Playwright is installed before doing any file work
    if (!await preflightScan(scanMode)) {
        p.outro(chalk.red('Full scan aborted.'));
        return;
    }

    const input = await resolveInputFiles(target, options);
    if (input === null) {
        return;
    }

    const { targetPath, preResolvedFiles } = input;

    displayScanConfiguration(config, scanMode, options, target);

    const result = await executeScan(config, scanMode, targetPath, preResolvedFiles, options.exclude || []);
    if (result === null) {
        return;
    }

    const { violations, warnings } = result;
    await handleScanResult(violations, warnings, config, scanMode, options);
}

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

/**
 * Determine scan mode from CLI options or config default
 *
 * @param {Object} options - CLI options
 * @param {Object} config - User configuration
 * @returns {string} - 'quick' or 'full'
 */
function determineScanMode(options, config) {
    if (options.quick) return SCAN_MODES.QUICK;
    if (options.full)  return SCAN_MODES.FULL;
    return config.scan?.defaultMode || SCAN_MODES.QUICK;
}

// -----------------------------------------------------------------------------
// Display Helpers
// -----------------------------------------------------------------------------

/**
 * Display current scan configuration
 *
 * @param {Object} config - User configuration
 * @param {string} scanMode - Current scan mode
 * @param {Object} options - CLI options
 * @param {string|null} target - Target path
 */
function displayScanConfiguration(config, scanMode, options, target) {
    const modeDisplay = scanMode === SCAN_MODES.FULL
        ? chalk.green(UI.SCAN_LABEL_FULL)
        : chalk.yellow(UI.SCAN_LABEL_QUICK);

    const scopeLine = options.changed
        ? `Scope:     ${chalk.cyan('Changed files only')}${target ? chalk.dim(` (${target})`) : ''}\n`
        : '';

    const exitGateLine = options.failOnAny
        ? `Exit gate: ${chalk.red('Any violation')}\n`
        : options.failOnSerious
            ? `Exit gate: ${chalk.red('Serious')} ${chalk.dim('or worse')}\n`
            : options.failOnCritical
                ? `Exit gate: ${chalk.red('Critical only')}\n`
                : '';

    const baselineLine = options.saveBaseline
        ? `Baseline:  ${chalk.cyan('Saving → allycat-baseline.json')}\n`
        : options.failOnNew
            ? `Baseline:  ${chalk.cyan('Active → fail on NEW violations (exit 4)')}\n`
            : '';

    const excludeLine = options.exclude?.length
        ? `Excluding: ${chalk.yellow(options.exclude.join(', '))}\n`
        : '';

    p.note(
        `Mode:      ${modeDisplay}\n` +
        scopeLine +
        exitGateLine +
        baselineLine +
        excludeLine +
        `Standard:  ${chalk.bold(getStandardLabel(config.selectedStandard))}\n` +
        `RTL Check: ${config.rules.rtl ? chalk.green('Enabled') : chalk.dim('Disabled')}\n` +
        `Output:    ${chalk.bold(options.output || 'terminal')}\n` +
        `Parallel:  ${config.performance.concurrencyIsAuto ? `Auto → ${chalk.bold(config.performance.concurrency)} files` : `${chalk.bold(config.performance.concurrency)} files`}\n` +
        chalk.dim(`File types: ${SUPPORTED_EXTENSIONS_DISPLAY}`),
        'Scan Configuration'
    );
}
