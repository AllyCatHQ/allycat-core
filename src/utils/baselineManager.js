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
import { BASELINE_FILE } from '../constants.js';

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
        file:        v.file,
        rule:        v.id,
        fingerprint: fingerprint(v.html),
        selector:    v.selector,
        element:     (v.html || '').trim()   // human-readable only — not used for matching
    }));

    const baseline = {
        createdAt: new Date().toISOString(),
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
        process.stderr.write(`[allycat] Warning: could not parse ${BASELINE_FILE} — treating as missing\n`);
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
        const fp  = fingerprint(v.html);
        const idx = available.findIndex(
            e => e.file        === v.file &&
                 e.rule        === v.id   &&
                 e.fingerprint === fp     &&
                 e.selector    === v.selector
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