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

    const agents = agentCount(fileCount, violations.length);
    if (agents === 0) return prompt;

    return `${prompt} This touches ${plural(fileCount, 'file')}. ` +
        `Split the work by file across exactly ${agents} subagents, never giving the same file to two agents. ` +
        'Ask each agent to report back in 5 lines or fewer.';
}

/**
 * How many subagents the scan needs: 0 while one session can handle it,
 * otherwise enough that none exceeds the per-agent limits (capped, and never
 * more agents than files).
 */
function agentCount(fileCount, violationCount) {
    const { MAX_VIOLATIONS_PER_AGENT, MAX_FILES_PER_AGENT, MAX_AGENTS } = FIX_SUBAGENT;
    const needed = Math.max(
        Math.ceil(violationCount / MAX_VIOLATIONS_PER_AGENT),
        Math.ceil(fileCount / MAX_FILES_PER_AGENT),
    );
    if (needed <= 1 || fileCount < 2) return 0;
    return Math.min(needed, MAX_AGENTS, fileCount);
}
