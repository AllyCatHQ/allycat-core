/**
 * Configuration Loader
 * 
 * Shared utilities for loading and validating allycat configuration.
 * Used by scan, and potentially future commands (fix, report, etc.)
 * 
 * @module utils/configLoader
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG_FILE_NAME, SCAN_MODES, STANDARDS } from '../constants.js';

// -----------------------------------------------------------------------------
// Default Configuration
// -----------------------------------------------------------------------------

/**
 * Canonical defaults used when no allycat.config.json exists.
 * Single source of truth — update here to change defaults for all new projects.
 *
 * performance.concurrency is intentionally null so sanitizeConfig() computes
 * a RAM-aware ceiling automatically, exactly as it does for user configs.
 */
export const DEFAULT_CONFIG = {
    selectedStandard: STANDARDS.WCAG_AA,
    scan:             { defaultMode: SCAN_MODES.QUICK },
    rules:            { rtl: false },
    ai:               { enabled: false },
    performance:      { concurrency: null },
};

// -----------------------------------------------------------------------------
// Config Sanitization
// -----------------------------------------------------------------------------

const MEMORY_PER_SLOT = {
    [SCAN_MODES.QUICK]: 200 * 1024 * 1024,  // ~200MB per JSDOM instance (benchmarked: 163MB worst-case + 23% margin)
    [SCAN_MODES.FULL]:  500 * 1024 * 1024   // ~500MB per Playwright/Chromium instance (benchmarked: 413MB worst-case + 21% margin)
};

const SAFE_RAM_RATIO             = 0.6; // Never use more than 60% of system RAM
const CPU_CONCURRENCY_MULTIPLIER = 4;   // logical cores × 4 for async/IO-interleaved JSDOM work
const FULL_SCAN_MAX              = 8;   // Playwright: CPU/IO bound regardless of RAM (benchmarked)
const ABSOLUTE_MIN               = 1;

/**
 * Compute a safe concurrency ceiling based on available system RAM and CPU count.
 *
 * Uses the minimum of:
 *   - 60% of total RAM divided by memory cost per slot (prevents OOM)
 *   - logical CPU cores × 4 (prevents event-loop thrashing for JSDOM)
 *   - FULL_SCAN_MAX = 8 for full mode (Playwright CPU/IO bound — benchmark-backed)
 * Result is never below 1 regardless of machine state.
 *
 * @param {'quick'|'full'} scanMode
 * @returns {number}
 */
export function getSafeConcurrencyCeiling(scanMode = SCAN_MODES.QUICK) {
    const totalRam   = os.totalmem();
    const usableRam  = totalRam * SAFE_RAM_RATIO;
    const memPerSlot = MEMORY_PER_SLOT[scanMode] ?? MEMORY_PER_SLOT[SCAN_MODES.QUICK];
    const fromRam    = Math.floor(usableRam / memPerSlot);
    const fromCpu    = os.cpus().length * CPU_CONCURRENCY_MULTIPLIER;
    const hardMax    = scanMode === SCAN_MODES.FULL ? FULL_SCAN_MAX : Infinity;
    return Math.max(ABSOLUTE_MIN, Math.min(fromRam, fromCpu, hardMax));
}

/**
 * Clamp a raw concurrency value to a safe range for the given scan mode.
 * Falls back to a safe default if the value is missing or non-numeric.
 *
 * @param {*} raw - Raw value from config (may be undefined, string, number)
 * @param {'quick'|'full'} scanMode
 * @returns {number}
 */
function clampConcurrency(raw, scanMode) {
    const ceiling = getSafeConcurrencyCeiling(scanMode);
    const parsed  = parseInt(raw, 10);
    const valid   = !isNaN(parsed) && parsed >= ABSOLUTE_MIN;
    const clamped = valid ? Math.min(parsed, ceiling) : ceiling;

    if (valid && parsed > ceiling) {
        console.warn(
            `[allycat] performance.concurrency "${parsed}" exceeds safe limit ` +
            `for your system in ${scanMode} mode. Clamped to ${clamped}.`
        );
    }

    return clamped;
}

/**
 * Sanitize raw config loaded from disk.
 * Clamps concurrency to a RAM-aware safe ceiling and fills missing keys with defaults.
 *
 * @param {Object} raw      - Raw parsed JSON config
 * @param {'quick'|'full'} scanMode
 * @returns {Object}
 */
function sanitizeConfig(raw, scanMode) {
    return {
        ...raw,
        performance: {
            ...raw?.performance,
            concurrency:       clampConcurrency(raw?.performance?.concurrency, scanMode),
            concurrencyIsAuto: raw?.performance?.concurrency == null,
        }
    };
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Load configuration from the project root.
 * Falls back to DEFAULT_CONFIG if no file exists — never returns null.
 * Sanitizes and clamps all numeric values before returning.
 *
 * The returned object always includes a `configIsDefault` boolean flag:
 *   - true  → no config file found, defaults were used
 *   - false → config was loaded from disk
 *
 * @param {'quick'|'full'} scanMode - Used to compute safe concurrency ceiling
 * @returns {Object} - Configuration object (never null)
 */
export function loadConfig(scanMode = SCAN_MODES.QUICK) {
    const configPath = getConfigPath();

    if (!fs.existsSync(configPath)) {
        return { ...sanitizeConfig(DEFAULT_CONFIG, scanMode), configIsDefault: true };
    }

    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return { ...sanitizeConfig(raw, scanMode), configIsDefault: false };
}

/**
 * Check if configuration file exists
 * 
 * @returns {boolean} - True if config exists
 */
export function configExists() {
    return fs.existsSync(getConfigPath());
}

/**
 * Get the full path to the configuration file
 * 
 * @returns {string} - Absolute path to config file
 */
export function getConfigPath() {
    return path.resolve(process.cwd(), CONFIG_FILE_NAME);
}

/**
 * Save configuration to the project root
 * 
 * @param {Object} config - Configuration object to save
 */
export function saveConfig(config) {
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2));
}