/**
 * Last Scan Store
 *
 * Single source of truth for the "last scan" hand-off file shared by
 * `allycat scan` (writer) and `allycat fix` (reader).
 *
 * Location: <temp folder>/allycat-last-scan.json — one fixed file, overwritten by each scan.
 * Temp folder is ALLYCAT_TMPDIR when set (tests), otherwise the OS temp folder.
 *
 * @module utils/lastScanStore
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { formatViolationForJson } from './violationFormatter.js';

const LAST_SCAN_FILE = 'allycat-last-scan.json';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Absolute path of the saved last-scan file.
 *
 * @returns {string}
 */
export function getLastScanPath() {
    return path.join(process.env.ALLYCAT_TMPDIR || os.tmpdir(), LAST_SCAN_FILE);
}

/**
 * Save the violations of a completed scan, replacing any previous save.
 * Violations use the same shape as the JSON report (`allycat scan -j`),
 * so the file matches the documented public format.
 *
 * @param {Array} violations - All violations from the scan
 * @throws If the file cannot be written — callers decide whether that matters
 */
export function saveLastScan(violations) {
    const data = {
        scannedAt: new Date().toISOString(),
        cwd: process.cwd(),
        violations: violations.map(formatViolationForJson),
    };
    fs.writeFileSync(getLastScanPath(), JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Load the saved last scan.
 *
 * @returns {{ status: 'ok', data: Object } | { status: 'missing' } | { status: 'invalid' }}
 */
export function loadLastScan() {
    let raw;
    try {
        raw = fs.readFileSync(getLastScanPath(), 'utf8');
    } catch {
        return { status: 'missing' };
    }

    try {
        const data = JSON.parse(raw);
        if (!data || !Array.isArray(data.violations)) return { status: 'invalid' };
        return { status: 'ok', data };
    } catch {
        return { status: 'invalid' };
    }
}
