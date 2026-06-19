/**
 * Terminal Outputter
 *
 * Renders violations to the terminal in human-readable format.
 * Handles both plain output and baseline-annotated output (NEW / BASELINE labels).
 *
 * @module commands/outputters/terminalOutputter
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';
import { UI } from '../../constants.js';
import { formatSummary, formatByFile } from '../../utils/violationFormatter.js';
import { pickTip } from '../../utils/tips.js';

// -----------------------------------------------------------------------------
// Terminal Output
// -----------------------------------------------------------------------------

/**
 * Output violations to terminal with enhanced formatting
 *
 * @param {Array} violations - Scan violations
 * @param {string} scanMode - Current scan mode
 */
export function outputTerminal(violations, scanMode, options = {}) {
    if (violations.length === 0) {
        console.log('');
        p.outro(chalk.green('✔ No accessibility issues found!'));
        p.outro(chalk.gray.bold('Developer Tool Only. Limited Scope. Manual verification recommended.'));
        return;
    }

    const {
        snippet      = true,
        help         = true,
        wcag         = true,
        selector     = true,
        affected     = true,
        summaryStyle = 'default',
    } = options;

    const formattedOutput = formatByFile(violations, {
        showSnippet:  snippet,
        showSelector: selector,
        showHelp:     help,
        showWcag:     wcag,
        showAffected: affected,
    });
    console.log(formattedOutput);

    const summary = formatSummary(violations, scanMode, summaryStyle);
    console.log(summary);

    displayTerminalTips({ scanMode, violationCount: violations.length, options });
}

// -----------------------------------------------------------------------------
// Baseline Terminal Output
// -----------------------------------------------------------------------------

/**
 * Output violations to terminal with NEW / BASELINE labels.
 *
 * @param {{ newViolations: Array, baselineViolations: Array, staleCount: number }} baselineResult
 * @param {string} scanMode
 */
export function outputTerminalWithBaseline({ newViolations, baselineViolations, staleCount }, scanMode, options = {}) {
    const allViolations = [
        ...newViolations.map(v => ({ ...v, _baselineStatus: 'NEW' })),
        ...baselineViolations.map(v => ({ ...v, _baselineStatus: 'BASELINE' }))
    ];

    if (allViolations.length === 0) {
        console.log('');
        p.outro(chalk.green('✔ No accessibility issues found!'));
        p.outro(chalk.gray.bold('Developer Tool Only. Limited Scope. Manual verification recommended.'));
        return;
    }

    // Group by file preserving insertion order
    const byFile = allViolations.reduce((acc, v) => {
        if (!acc[v.file]) acc[v.file] = [];
        acc[v.file].push(v);
        return acc;
    }, {});

    const output = [];

    for (const [file, fileViolations] of Object.entries(byFile)) {
        const fileNew  = fileViolations.filter(v => v._baselineStatus === 'NEW').length;
        const fileSup  = fileViolations.filter(v => v._baselineStatus === 'BASELINE').length;

        const countParts = [];
        if (fileNew  > 0) countParts.push(chalk.red(`${fileNew} new`));
        if (fileSup  > 0) countParts.push(chalk.dim(`${fileSup} suppressed`));

        output.push('');
        output.push(chalk.underline.cyan(file));
        output.push(chalk.dim(`${fileViolations.length} issue${fileViolations.length !== 1 ? 's' : ''}`) +
            (countParts.length ? chalk.dim('  (') + countParts.join(chalk.dim(' · ')) + chalk.dim(')') : ''));
        output.push('');

        for (const violation of fileViolations) {
            const isNew = violation._baselineStatus === 'NEW';
            const labelBadge = isNew
                ? chalk.bgRed.white.bold('  NEW      ')
                : chalk.bgGray.white('  BASELINE ');

            output.push(`${labelBadge}  ${formatViolationInline(violation)}`);
            if (!isNew) {
                output.push(chalk.dim('   (suppressed — exists in allycat-baseline.json)'));
            }
            output.push('');
        }
    }

    console.log(output.join('\n'));

    // Footer summary
    const totalNew = newViolations.length;
    const totalSup = baselineViolations.length;

    if (totalNew > 0) {
        console.log(chalk.red(`✖ ${totalNew} new violation${totalNew !== 1 ? 's' : ''} — pipeline blocked`));
    }
    if (totalSup > 0) {
        console.log(chalk.dim(`✓ ${totalSup} baseline violation${totalSup !== 1 ? 's' : ''} suppressed (run --save-baseline to update baseline)`));
    }

    displayTerminalTips({
        scanMode,
        violationCount: newViolations.length + baselineViolations.length,
        options,
    });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Format a single violation inline (impact badge + description + rule + file).
 * Used in baseline output where the label badge precedes the normal content.
 *
 * @param {Object} violation
 * @returns {string}
 */
function formatViolationInline(violation) {
    const impactBadges = {
        critical: chalk.bgRed.white.bold(' CRITICAL '),
        serious:  chalk.bgRed.white(' SERIOUS '),
        moderate: chalk.bgYellow.black(' MODERATE '),
        minor:    chalk.bgBlue.white(' MINOR ')
    };
    const impactBadge = impactBadges[violation.impact] || chalk.bgGray.white(` ${(violation.impact || 'unknown').toUpperCase()} `);

    const location = violation.lineNumber
        ? chalk.cyan(`${violation.file}`) + chalk.green(`:${violation.lineNumber}`)
        : chalk.cyan(`${violation.file}`);

    return [
        `${impactBadge}  ${violation.description}`,
        chalk.dim(`   Rule: ${violation.id}`),
        chalk.dim('   File: ') + location,
        violation.selector ? chalk.dim(`   Element: ${violation.selector}`) : '',
        violation.html     ? chalk.dim(`   HTML: ${chalk.yellow(violation.html.substring(0, 80))}`) : ''
    ].filter(Boolean).join('\n');
}

/**
 * Display a random contextual tip inside a styled box.
 *
 * @param {Object} ctx
 * @param {string} ctx.scanMode
 * @param {number} ctx.violationCount
 * @param {Object} ctx.options
 */
function displayTerminalTips({ scanMode, violationCount, options }) {
    if (options.tips === false) return;

    const tip = pickTip({ scanMode, violationCount });

    const INNER = 48;
    const PAD   = 4;
    const MAX_TEXT = INNER - PAD;

    const words = tip.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (next.length > MAX_TEXT) {
            lines.push(line);
            line = word;
        } else {
            line = next;
        }
    }
    if (line) lines.push(line);

    const titleLabel = ' Tip ';
    const sideDashes = INNER - titleLabel.length;
    const boxTop    = chalk.dim('  ╭' + '─'.repeat(Math.floor(sideDashes / 2)) + titleLabel + '─'.repeat(Math.ceil(sideDashes / 2)) + '╮');
    const boxBottom = chalk.dim('  ╰' + '─'.repeat(INNER) + '╯');
    const boxEmpty  = chalk.dim('  │' + ' '.repeat(INNER) + '│');

    const boxRow = (text) => {
        const pad = ' '.repeat(Math.max(0, INNER - text.length - PAD));
        return chalk.dim('  │') + '  ' + chalk.dim(text) + pad + chalk.dim('  │');
    };

    console.log('');
    console.log(boxTop);
    console.log(boxEmpty);
    for (const l of lines) {
        console.log(boxRow(l));
    }
    console.log(boxEmpty);
    console.log(boxBottom);
    console.log('');
}
