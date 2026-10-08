/**
 * Scan Freshness
 *
 * Tells `allycat fix` how old the saved scan is and whether the files it
 * points at were changed since. Read-only: never touches the saved scan.
 *
 * @module utils/scanFreshness
 */

import fs from 'fs';
import path from 'path';

const MINUTE = 60 * 1000;
const HOUR   = 60 * MINUTE;
const DAY    = 24 * HOUR;

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Human-readable age of a scan, rounded down ("just now", "2 hours ago").
 *
 * @param {number} scannedAtMs - Scan time in ms (from Date.parse)
 * @param {number} [nowMs=Date.now()]
 * @returns {string}
 */
export function formatScanAge(scannedAtMs, nowMs = Date.now()) {
    const elapsed = nowMs - scannedAtMs;
    if (elapsed < MINUTE) return 'just now';   // also covers clock skew (negative)
    if (elapsed < HOUR)   return plural(Math.floor(elapsed / MINUTE), 'minute') + ' ago';
    if (elapsed < DAY)    return plural(Math.floor(elapsed / HOUR), 'hour') + ' ago';
    return plural(Math.floor(elapsed / DAY), 'day') + ' ago';
}

/**
 * Count distinct violation files modified after the scan, or deleted since.
 * Files that can't be checked for any other reason are skipped.
 *
 * @param {Array<{file: string}>} violations - Saved violations
 * @param {string} cwd - Folder the scan ran in (relative paths resolve against it)
 * @param {number} scannedAtMs - Scan time in ms
 * @returns {number}
 */
export function countChangedFiles(violations, cwd, scannedAtMs) {
    let changed = 0;

    for (const file of distinctFiles(violations)) {
        try {
            if (fs.statSync(path.resolve(cwd, file)).mtimeMs > scannedAtMs) changed++;
        } catch (err) {
            if (err.code === 'ENOENT') changed++;
        }
    }
    return changed;
}

/**
 * Distinct file paths the violations point at. Violations without a string `file` are skipped.
 *
 * @param {Array<{file?: string}>} violations
 * @returns {Set<string>}
 */
export function distinctFiles(violations) {
    return new Set(violations.map(v => v.file).filter(f => typeof f === 'string'));
}

/**
 * "1 file" / "2 files".
 *
 * @param {number} count
 * @param {string} word - Singular form
 * @returns {string}
 */
export function plural(count, word) {
    return `${count} ${word}${count !== 1 ? 's' : ''}`;
}
