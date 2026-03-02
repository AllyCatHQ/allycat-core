/**
 * Violation Formatter
 * 
 * Formats accessibility violations for terminal output with:
 * - Line numbers
 * - Element snippets
 * - Clickable file links
 * - Color-coded severity
 * 
 * @module utils/violationFormatter
 */

import chalk from 'chalk';
import { SCAN_MODES } from '../constants.js';
import {
    findLineNumber,
    generateFileLink,
    simplifySelector,
    truncateSnippet
} from './sourceMapper.js';

/**
 * Format a single violation for terminal output
 * 
 * @param {Object} violation - Violation object with location data
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted string for terminal
 */
export function formatViolation(violation, options = {}) {
    const { showSnippet = true, showSelector = true } = options;
    
    const lines = [];
    
    // Header: Impact + Description
    const impactBadge = formatImpact(violation.impact);
    lines.push(`${impactBadge} ${violation.description}`);
    
    // Rule ID
    lines.push(chalk.dim(`   Rule: ${violation.id}`));
    
    // File location with line number (clickable in VS Code / iTerm2)
    const location = formatLocation(violation);
    lines.push(location);
    
    // Element selector (simplified)
    if (showSelector && violation.selector) {
        const selector = simplifySelector(violation.selector);
        lines.push(chalk.dim(`   Element: ${selector}`));
    }
    
    // HTML snippet (truncated)
    if (showSnippet && violation.html) {
        const snippet = truncateSnippet(violation.html, 60);
        lines.push(chalk.dim(`   HTML: ${chalk.yellow(snippet)}`));
    }
    
    // Line number highlight
    // if (violation.lineNumber) {
    //     lines.push(chalk.green(`   Line: ${violation.lineNumber}`));
    // }
    
    // Help text
    lines.push(chalk.dim(`   Help: ${violation.help}`));
    
    // WCAG tags
    if (violation.wcagTags && violation.wcagTags.length > 0) {
        lines.push(chalk.dim(`   WCAG: ${violation.wcagTags.join(', ')}`));
    }
    
    // Node count (if more than 1)
    if (violation.nodeCount && violation.nodeCount > 1) {
        lines.push(chalk.dim(`   Affected: ${violation.nodeCount} elements`));
    }
    
    // Contrast data (if applicable)
    if (violation.contrastData && violation.contrastData.contrastRatio) {
        const cd = violation.contrastData;
        lines.push(chalk.dim(`   Contrast: ${cd.contrastRatio.toFixed(2)}:1 (needs ${cd.expectedRatio}:1)`));
    }
    
    return lines.join('\n');
}

/**
 * Format impact level with color badge
 */
function formatImpact(impact) {
    const badges = {
        critical: chalk.bgRed.white.bold(' CRITICAL '),
        serious: chalk.bgRed.white(' SERIOUS '),
        moderate: chalk.bgYellow.black(' MODERATE '),
        minor: chalk.bgBlue.white(' MINOR ')
    };
    
    return badges[impact] || chalk.bgGray.white(` ${(impact || 'unknown').toUpperCase()} `);
}

/**
 * Format file location with optional line number
 */
function formatLocation(violation) {
    const { file, lineNumber } = violation;
   const displyedLocation = chalk.cyan(`   File: ${file}`);
    
    if (lineNumber) {
        return displyedLocation+chalk.green(`:${lineNumber}`);
    }
    
    return displyedLocation;
}

// -----------------------------------------------------------------------------
// Shared Helpers
// -----------------------------------------------------------------------------

/**
 * Count violations grouped by impact level
 * 
 * @param {Array} violations - Array of violation objects
 * @returns {Object} - Counts by impact level
 */
export function countByImpact(violations) {
    return {
        critical: violations.filter(v => v.impact === 'critical').length,
        serious: violations.filter(v => v.impact === 'serious').length,
        moderate: violations.filter(v => v.impact === 'moderate').length,
        minor: violations.filter(v => v.impact === 'minor').length,
    };
}

/**
 * Group violations by file path
 * 
 * @param {Array} violations - Array of violation objects
 * @returns {Object} - Violations grouped by file with counts
 */
export function groupByFile(violations) {
    return violations.reduce((accumulator, violation) => {
        const filePath = violation.file;

        if (!accumulator[filePath]) {
            accumulator[filePath] = { count: 0, critical: 0, serious: 0 };
        }

        accumulator[filePath].count++;

        if (violation.impact === 'critical') {
            accumulator[filePath].critical++;
        }
        if (violation.impact === 'serious') {
            accumulator[filePath].serious++;
        }

        return accumulator;
    }, {});
}

/**
 * Format a single violation for JSON output
 * 
 * @param {Object} violation - Violation object
 * @returns {Object} - JSON-formatted violation
 */
export function formatViolationForJson(violation) {
    const formatted = {
        file: violation.file,
        line: violation.lineNumber,
        rule: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        wcag: violation.wcagTags,
        element: {
            selector: violation.selector,
            html: violation.html
        }
    };

    if (violation.contrastData) {
        formatted.contrast = violation.contrastData;
    }

    return formatted;
}

// -----------------------------------------------------------------------------
// Terminal Formatting
// -----------------------------------------------------------------------------

/**
 * Format summary statistics
 *
 * Renders a full bordered box with per-impact mini bar charts:
 *
 *   ╭──────────────── Scan Summary ────────────────╮
 *   │                                              │
 *   │  Total: 7 violations in 3 files              │
 *   │                                              │
 *   │  ● CRITICAL   4   ████████████████          │
 *   │  ● SERIOUS    2   ████████                  │
 *   │  ● MODERATE   0   —                         │
 *   │  ● MINOR      1   ████                      │
 *   │                                              │
 *   │  ⚠  Use --full for contrast checking        │
 *   ╰──────────────────────────────────────────────╯
 *
 * @param {Array} violations - All violations
 * @param {string} scanMode - 'quick' or 'full'
 * @returns {string} - Formatted summary
 */
export function formatSummary(violations, scanMode) {
    if (violations.length === 0) {
        return chalk.green('✔ No accessibility issues found!');
    }

    const byImpact = countByImpact(violations);
    const fileCount = Object.keys(
        violations.reduce((acc, v) => { acc[v.file] = 1; return acc; }, {})
    ).length;

    // Box dimensions — 2 leading spaces for indentation, INNER chars between the │ borders
    const INNER   = 48;
    const MAX_BAR = 18;

    // Box border pieces
    const titleLabel = ' Scan Summary ';
    const sideDashes = INNER - titleLabel.length;
    const BOX_TOP    = chalk.dim('  ╭' + '─'.repeat(Math.floor(sideDashes / 2)) + titleLabel + '─'.repeat(Math.ceil(sideDashes / 2)) + '╮');
    const BOX_BOTTOM = chalk.dim('  ╰' + '─'.repeat(INNER) + '╯');
    const BOX_EMPTY  = chalk.dim('  │' + ' '.repeat(INNER) + '│');

    // Wrap a chalk-colored content string inside box borders.
    // visualLen = number of actual printed characters (no ANSI codes) in coloredContent.
    const boxRow = (coloredContent, visualLen) => {
        const pad = ' '.repeat(Math.max(0, INNER - visualLen));
        return chalk.dim('  │') + coloredContent + pad + chalk.dim('│');
    };

    // Impact row: label + count + proportional bar (or — for zero)
    const maxCount = Math.max(byImpact.critical, byImpact.serious, byImpact.moderate, byImpact.minor, 1);

    const impactRow = (label, count, colorFn) => {
        const labelStr = label.padEnd(8);          // CRITICAL=8, SERIOUS→8, MODERATE=8, MINOR→8
        const countStr = String(count).padStart(2);
        // Visual prefix = "  ● " (4) + label (8) + "  " (2) + count (2) + "   " (3) = 19 chars
        const PREFIX_LEN = 19;

        if (count === 0) {
            return boxRow(chalk.dim(`  ● ${labelStr}  ${countStr}   —`), PREFIX_LEN + 1);
        }

        const bar     = '█'.repeat(Math.round((count / maxCount) * MAX_BAR));
        const colored = '  ' + colorFn(`● ${labelStr}`) + '  ' + colorFn(countStr) + '   ' + colorFn(bar);
        return boxRow(colored, PREFIX_LEN + bar.length);
    };

    // Total line (plain text measured for padding, then colored)
    const vCount    = violations.length;
    const totalText = `  Total: ${vCount} violation${vCount > 1 ? 's' : ''} in ${fileCount} file${fileCount > 1 ? 's' : ''}`;

    const lines = [
        '',
        BOX_TOP,
        BOX_EMPTY,
        boxRow(chalk.red.bold(totalText), totalText.length),
        BOX_EMPTY,
        impactRow('CRITICAL', byImpact.critical,  chalk.red),
        impactRow('SERIOUS',  byImpact.serious,   chalk.red),
        impactRow('MODERATE', byImpact.moderate,  chalk.yellow),
        impactRow('MINOR',    byImpact.minor,     chalk.blue),
        BOX_EMPTY,
    ];

    if (scanMode === SCAN_MODES.QUICK) {
        const tip = '  ⚠  Use --full for contrast checking';
        lines.push(boxRow(chalk.dim(tip), tip.length));
        lines.push(BOX_EMPTY);
    }

    lines.push(BOX_BOTTOM);
    return lines.join('\n');
}

/**
 * Format violations grouped by file
 * 
 * @param {Array} violations - All violations
 * @param {Object} options - Formatting options
 * @returns {string} - Formatted output
 */
export function formatByFile(violations, options = {}) {
    if (violations.length === 0) {
        return chalk.green('✔ No accessibility issues found!');
    }
    
    // Group by file
    const byFile = violations.reduce((acc, v) => {
        if (!acc[v.file]) acc[v.file] = [];
        acc[v.file].push(v);
        return acc;
    }, {});
    
    const output = [];
    
    for (const [file, fileViolations] of Object.entries(byFile)) {
        // File header
        output.push('');
        output.push(chalk.underline.cyan(file));
        output.push(chalk.dim(`${fileViolations.length} issue${fileViolations.length > 1 ? 's' : ''}`));
        output.push('');
        
        // Sort by line number (if available), then by impact
        const sorted = fileViolations.sort((a, b) => {
            if (a.lineNumber && b.lineNumber) {
                return a.lineNumber - b.lineNumber;
            }
            if (a.lineNumber) return -1;
            if (b.lineNumber) return 1;
            
            const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
            return (impactOrder[a.impact] || 4) - (impactOrder[b.impact] || 4);
        });
        
        for (const violation of sorted) {
            output.push(formatViolation(violation, options));
            output.push('');
        }
    }
    
    return output.join('\n');
}
