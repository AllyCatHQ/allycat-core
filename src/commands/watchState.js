/**
 * Watch State
 *
 * Pure helpers for tracking and diffing violation state across watch cycles.
 * No I/O, no rendering — only data transformation and key-based comparison.
 *
 * Responsibilities:
 *  - Build identity keys for violations (rule id + html snippet, line-agnostic)
 *  - Produce indexed key arrays that handle duplicate violations correctly
 *  - Populate the shared state map from a flat scan result
 *  - Compute the NEW / FIXED delta between two violation snapshots
 *  - Normalize file paths for cross-platform key consistency
 *  - Aggregate total violation counts across all watched files
 *  - Provide the severity comparator used for sorted rendering
 *
 * @module commands/watchState
 */

import path from 'path';
import { IMPACT_ORDER } from '../constants.js';
import { normalizePathSeparators } from '../utils/pathUtils.js';

// -----------------------------------------------------------------------------
// Violation identity
// -----------------------------------------------------------------------------

/**
 * Base identity key for a violation: rule id + html snippet only.
 * Line number is intentionally excluded — inserting/removing lines above a
 * violation shifts its line number without changing the violation itself, which
 * would cause false FIXED + NEW pairs on every Enter keypress.
 *
 * @param {Object} v - Violation object from axe-core
 * @returns {string}
 */
export function violationKey(v) {
    return `${v.id}|${(v.html ?? '').slice(0, 80)}`;
}

/**
 * Build an array of unique keys for a violation list.
 * Duplicates (same rule, same html) get a numeric suffix
 * (base#0, base#1) so copy-pasted identical elements are tracked correctly.
 *
 * @param {Array} violations
 * @returns {string[]}
 */
export function indexedKeys(violations) {
    const counts = {};
    return violations.map(v => {
        const base = violationKey(v);
        const n = counts[base] = (counts[base] ?? -1) + 1;
        return `${base}#${n}`;
    });
}

// -----------------------------------------------------------------------------
// State management
// -----------------------------------------------------------------------------

/**
 * Group violations by normalized file path into the shared state map.
 * Each key maps to an array of violations for that file.
 *
 * @param {Map}   state      - Shared state map (mutated in-place)
 * @param {Array} violations - Flat violation array from a scan result
 */
export function groupViolationsByFile(state, violations) {
    for (const v of violations) {
        const key = normalizePath(v.file);
        if (!state.has(key)) state.set(key, []);
        state.get(key).push(v);
    }
}

/**
 * Compare previous and current violation lists using indexed keys.
 * Returns violations that are newly introduced (added) and violations
 * that have been resolved (fixed) since the last scan of this file.
 *
 * @param {Array} previous - Violations before the rescan
 * @param {Array} current  - Violations after the rescan
 * @returns {{ added: Array, fixed: Array }}
 */
export function computeDelta(previous, current) {
    const prevIndexed = indexedKeys(previous);
    const currIndexed = indexedKeys(current);
    const prevSet = new Set(prevIndexed);
    const currSet = new Set(currIndexed);

    return {
        added: current.filter((_, i) => !prevSet.has(currIndexed[i])),
        fixed: previous.filter((_, i) => !currSet.has(prevIndexed[i])),
    };
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------

/**
 * Normalize a file path to forward slashes for consistent Map keying
 * across platforms (Windows uses backslashes).
 *
 * @param {string} rawPath
 * @returns {string}
 */
export function normalizePath(rawPath) {
    return normalizePathSeparators(path.normalize(rawPath));
}

/**
 * Sum the total number of violations across all files in the state map.
 *
 * @param {Map} state - Map<normalizedPath, violation[]>
 * @returns {number}
 */
export function totalViolations(state) {
    let n = 0;
    for (const violations of state.values()) n += violations.length;
    return n;
}

/**
 * Comparator: sort violations by impact severity (critical → serious → moderate → minor).
 * Used for consistent ordering in all rendered violation lists.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
export function bySeverity(a, b) {
    return (IMPACT_ORDER[a.impact] ?? 4) - (IMPACT_ORDER[b.impact] ?? 4);
}
