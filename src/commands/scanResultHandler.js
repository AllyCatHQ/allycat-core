/**
 * Scan Result Handler
 *
 * Owns the post-scan phase: output routing and CI exit code enforcement.
 * Called once a scan completes successfully.
 */

import * as p from '@clack/prompts';
import chalk from 'chalk';
import { outputResults } from './outputters/index.js';
import { saveBaseline, loadBaseline, classifyViolations, detectRenames, remapBaselineFiles } from '../utils/baselineManager.js';

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
export async function handleScanResult(violations, warnings, config, scanMode, options) {
    // --save-baseline: snapshot current violations and always exit 0
    if (options.saveBaseline) {
        const dest = saveBaseline(violations, config, scanMode);
        console.log('');
        p.log.success(chalk.green(`Baseline saved → ${chalk.bold('allycat-baseline.json')}`));
        console.log(chalk.dim(`  ${violations.length} violation${violations.length !== 1 ? 's' : ''} recorded across ${countFiles(violations)} file${countFiles(violations) !== 1 ? 's' : ''}`));
        console.log(chalk.dim(`  Commit this file to your repository.`));
        console.log('');
        console.log(chalk.dim(`  Next: run `) + chalk.cyan('allycat scan --fail-on-new') + chalk.dim(` to fail CI on new violations`));
        console.log('');
        return; // always exit 0
    }

    // --fail-on-new: load baseline and classify violations
    let baselineResult = null;
    if (options.failOnNew) {
        const baseline = loadBaseline();
        if (!baseline) {
            process.stderr.write(chalk.yellow('⚠ [allycat] Warning: --fail-on-new specified but no allycat-baseline.json found. Run --save-baseline first. Continuing without baseline check.\n'));
        } else {
            // Layer 1: git rename detection (in-memory only, best-effort)
            const renameMap = detectRenames(baseline.gitCommit);
            const remappedViolations = remapBaselineFiles(baseline.violations, renameMap);
            const remappedCount = remappedViolations.filter(
                (e, i) => e.file !== (baseline.violations ?? [])[i]?.file
            ).length;
            if (remappedCount > 0) {
                process.stderr.write(chalk.yellow(`⚠ [allycat] File rename(s) detected since baseline was saved — ${remappedCount} baseline entr${remappedCount !== 1 ? 'ies' : 'y'} remapped in memory. Re-run --save-baseline to persist the change.\n`));
            }
            // Layer 2: four-key composite matching (unchanged)
            const preparedBaseline = {
                ...baseline,
                violations: remappedViolations
            };
            baselineResult = classifyViolations(violations, preparedBaseline);
        }
    }

    await outputResults(violations, config, scanMode, options, warnings, baselineResult);

    // Exit code 4 takes priority over severity gates
    if (baselineResult && baselineResult.newViolations.length > 0) {
        process.exit(4);
    }

    // Severity gates apply to all violations (including baseline-suppressed ones)
    exitOnThreshold(violations, options);
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function countFiles(violations) {
    return new Set(violations.map(v => v.file)).size;
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
