/**
 * Baseline Manager
 *
 * Handles violation baseline snapshots for --save-baseline / --fail-on-new workflow.
 *
 * Matching strategy: composite key (file + rule + SHA-256(violation.html.trim()) + selector).
 * All four fields must match exactly — no fuzzy logic, no line numbers.
 * Consumption-based: each baseline entry can only match one violation.
 *
 * @module utils/baselineManager
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { execFileSync } from 'child_process';
import chalk from 'chalk';
import { BASELINE_FILE } from '../constants.js';
import { normalizePathSeparators } from './pathUtils.js';

// -----------------------------------------------------------------------------
// Fingerprinting
// -----------------------------------------------------------------------------

/**
 * Compute SHA-256 fingerprint of violation.html.
 *
 * @param {string} html - The violation's raw HTML string
 * @returns {string} - Hex digest
 */
function fingerprint(html) {
    return createHash('sha256').update((html || '').trim()).digest('hex');
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Save all current violations as a baseline file in the current working directory.
 *
 * @param {Array}  violations - All violations from the scan
 * @param {Object} config     - User configuration (for metadata)
 * @param {string} scanMode   - 'quick' or 'full' (for metadata)
 * @returns {string} - Absolute path of the written file
 */
export function saveBaseline(violations, config, scanMode) {
    const entries = violations.map(v => ({
        // Always store forward-slash paths so baselines are portable across
        // OSes and match git's path output (rename detection)
        file:        normalizePathSeparators(v.file),
        rule:        v.id,
        fingerprint: fingerprint(v.html),
        selector:    v.stableSelector ?? v.selector,
        element:     (v.html || '').trim()   // human-readable only — not used for matching
    }));

    let gitCommit = null;
    try {
        gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe']
        }).trim();
    } catch { /* git unavailable — store null, no crash */ }

    const baseline = {
        createdAt: new Date().toISOString(),
        gitCommit,
        standard:  config?.selectedStandard ?? 'unknown',
        scanMode,
        violations: entries
    };

    const dest = path.resolve(process.cwd(), BASELINE_FILE);
    fs.writeFileSync(dest, JSON.stringify(baseline, null, 2), 'utf8');
    return dest;
}

/**
 * Load the baseline file from the current working directory.
 *
 * @returns {Object|null} - Parsed baseline object, or null if not found / unreadable
 */
export function loadBaseline() {
    const src = path.resolve(process.cwd(), BASELINE_FILE);
    if (!fs.existsSync(src)) return null;

    try {
        return JSON.parse(fs.readFileSync(src, 'utf8'));
    } catch {
        process.stderr.write(chalk.yellow(`⚠ [allycat] Warning: could not parse ${BASELINE_FILE} — treating as missing\n`));
        return null;
    }
}

/**
 * Classify each violation as NEW or BASELINE using consumption-based composite-key matching.
 *
 * Each baseline entry can only absorb one violation (prevents one stale entry from
 * suppressing two identical violations after a substitution).
 *
 * @param {Array}  violations - Current scan violations
 * @param {Object} baseline   - Parsed baseline object (from loadBaseline())
 * @returns {{ newViolations: Array, baselineViolations: Array, staleCount: number }}
 */
export function classifyViolations(violations, baseline) {
    // Mutable pool — entries are spliced out as they match
    const available = [...(baseline?.violations ?? [])];

    const newViolations      = [];
    const baselineViolations = [];

    for (const v of violations) {
        const fp        = fingerprint(v.html);
        const vselector = v.stableSelector ?? v.selector;
        // Normalize both sides: scan paths use backslashes on Windows, and
        // baselines saved before normalization may contain backslashes too
        const vfile     = normalizePathSeparators(v.file);
        const idx = available.findIndex(
            e => normalizePathSeparators(e.file) === vfile &&
                 e.rule        === v.id   &&
                 e.fingerprint === fp     &&
                 e.selector    === vselector
        );

        if (idx !== -1) {
            available.splice(idx, 1);   // consumed — cannot match again
            baselineViolations.push(v);
        } else {
            newViolations.push(v);
        }
    }

    return {
        newViolations,
        baselineViolations,
        staleCount: available.length
    };
}

// -----------------------------------------------------------------------------
// Rename Detection
// -----------------------------------------------------------------------------

/**
 * Detect file renames between the baseline commit and the working tree using git.
 * Returns a Map of oldPath → newPath (forward-slash, relative to the cwd —
 * the same shape as scan paths).
 * Returns an empty Map on any failure (git unavailable, shallow clone, bad commit, no renames).
 *
 * Diffing against the working tree (not HEAD) means uncommitted `git mv`
 * renames are detected too, and a chain of renames collapses to its net result.
 *
 * @param {string|null} fromCommit - git commit hash the baseline was saved at
 * @returns {Map<string,string>}
 */
export function detectRenames(fromCommit) {
    // Strict hash check: fromCommit comes from a user-editable JSON file and
    // must never be passed to git unvalidated (64 covers SHA-256 repos)
    if (!fromCommit || !/^[0-9a-f]{7,64}$/i.test(fromCommit)) return new Map();
    try {
        const output = execFileSync('git', [
            '-c', 'core.quotepath=off',     // never octal-escape non-ASCII paths
            'diff', '--find-renames', '--name-status', '-z',
            '--relative',                   // paths relative to cwd, like scan paths
            fromCommit                      // vs working tree — catches uncommitted git mv
        ], {
            encoding: 'utf8',
            stdio: ['pipe', 'pipe', 'pipe'],
            maxBuffer: 10 * 1024 * 1024     // default 1 MB truncates monorepo-sized diffs
        });

        // -z output is NUL-separated: most statuses carry one path,
        // rename/copy entries (R094, C100) carry two
        const parts = output.split('\0');
        const renames = new Map();
        let i = 0;
        while (i < parts.length - 1) {
            const status = parts[i];
            if (/^[RC]\d+$/.test(status)) {
                if (status[0] === 'R' && parts[i + 1] && parts[i + 2]) {
                    renames.set(parts[i + 1], parts[i + 2]);
                }
                i += 3;
            } else {
                i += 2;
            }
        }
        return renames;
    } catch {
        return new Map();
    }
}

/**
 * Remap baseline entry file paths using a rename map.
 * Returns the same array unchanged if the map is empty.
 *
 * Lookups are separator-normalized so baselines saved on Windows (backslash
 * paths) still match git's forward-slash output.
 *
 * @param {Array} entries - baseline.violations entries
 * @param {Map<string,string>} renameMap - oldPath → newPath
 * @returns {Array}
 */
export function remapBaselineFiles(entries, renameMap) {
    const safeEntries = entries ?? [];
    if (renameMap.size === 0) return safeEntries;
    return safeEntries.map(e => ({
        ...e,
        file: renameMap.get(normalizePathSeparators(e.file)) ?? e.file
    }));
}
