/**
 * Shell Quote
 *
 * Turns any string into a single, literal shell word. Nothing inside it is
 * expanded: no variables, globs, command substitution or separators.
 *
 * @module utils/shellQuote
 */

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Quote for POSIX sh (bash, zsh, dash). Single quotes keep everything literal;
 * an embedded `'` is written as `'\''` (close, escaped quote, reopen).
 *
 * @param {string} str
 * @returns {string}
 */
export function quotePosix(str) {
    return `'${str.replaceAll("'", "'\\''")}'`;
}

/**
 * Quote for PowerShell. Single quotes keep everything literal; an embedded
 * quote is doubled. PowerShell also treats the curly quotes ‘ ’ ‚ ‛ as single
 * quotes, so those are doubled too.
 *
 * @param {string} str
 * @returns {string}
 */
export function quotePowerShell(str) {
    return `'${str.replace(/['‘’‚‛]/g, (q) => q + q)}'`;
}
