/**
 * Fix Prompt
 *
 * Builds the prompt `allycat fix` hands to Claude Code. Large scans also get a
 * hint to split the work by file across subagents.
 *
 * @module utils/fixPrompt
 */

import { FIX_SUBAGENT } from '../constants.js';
import { distinctFiles, plural } from './scanFreshness.js';

/**
 * The prompt for Claude Code, sized to the scan.
 *
 * @param {string} scanPath - Full path of the saved scan file
 * @param {Array<{file?: string}>} violations - Saved violations
 * @returns {string}
 */
export function buildFixPrompt(scanPath, violations) {
    const fileCount = distinctFiles(violations).size;

    const prompt = `Read ${scanPath} — it lists ${plural(violations.length, 'violation')} found by AllyCat, ` +
        'an accessibility scanner. Make targeted fixes to each violation it lists. Do not rewrite whole files. ' +
        'Violations of the same rule usually need the same fix, so work rule by rule.';

    if (!isLargeScan(fileCount, violations.length)) return prompt;

    return `${prompt} This touches ${plural(fileCount, 'file')}. ` +
        'Split the work by file across subagents, never giving the same file to two agents. ' +
        'Before starting, tell the user how you split it.';
}

/** Big enough to split, and more than one file to split by. */
function isLargeScan(fileCount, violationCount) {
    return fileCount >= FIX_SUBAGENT.MIN_FILES ||
        (violationCount >= FIX_SUBAGENT.MIN_VIOLATIONS && fileCount >= 2);
}
