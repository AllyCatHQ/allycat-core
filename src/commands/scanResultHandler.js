/**
 * Scan Result Handler
 *
 * Owns the post-scan phase: output routing and CI exit code enforcement.
 * Called once a scan completes successfully.
 */

import { outputResults } from './scanOutputters.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Handle the completed scan result: route output and enforce CI exit thresholds.
 *
 * @param {Array} violations - All violations from the scan
 * @param {Array} warnings - All warnings from the scan
 * @param {Object} config - User configuration
 * @param {string} scanMode - 'quick' or 'full'
 * @param {Object} options - CLI options
 */
export function handleScanResult(violations, warnings, config, scanMode, options) {
    outputResults(violations, config, scanMode, options, warnings);
    exitOnThreshold(violations, options);
}

// -----------------------------------------------------------------------------
// CI Exit Code
// -----------------------------------------------------------------------------

/**
 * Exit with a non-zero code if a --fail-on-* threshold is set and matched.
 *
 * Severity order (axe-core): minor < moderate < serious < critical
 *   --fail-on-critical  →  exit 1  (critical only)
 *   --fail-on-serious   →  exit 2  (serious or critical)
 *   --fail-on-any       →  exit 3  (any violation)
 *
 * Distinct exit codes let CI pipelines distinguish which severity level
 * triggered the failure without parsing terminal output.
 *
 * @param {Array} violations - All violations from the scan
 * @param {Object} options   - CLI options
 */
function exitOnThreshold(violations, options) {
    if (options.failOnAny) {
        if (violations.length > 0) process.exit(3);
    } else if (options.failOnSerious) {
        if (violations.some(v => v.impact === 'serious' || v.impact === 'critical')) process.exit(2);
    } else if (options.failOnCritical) {
        if (violations.some(v => v.impact === 'critical')) process.exit(1);
    }
}
