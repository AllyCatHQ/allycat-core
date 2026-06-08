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
import { CONFIG_FILE_NAME, SCAN_MODES, STANDARDS, CURRENT_CONFIG_VERSION } from '../constants.js';

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
// Config Migration
// ⚠️  DEVELOPER NOTICE — READ BEFORE EDITING THIS SECTION OR allycat.config.json
// -----------------------------------------------------------------------------
// If you change the shape of allycat.config.json (add/rename/remove a key,
// change a value format), you MUST do ALL of the following:
//
//   1. Bump CURRENT_CONFIG_VERSION in src/constants.js
//   2. Add an `if (from < N)` block in migrateConfig() below
//   3. Update DEFAULT_CONFIG above if the new key needs a default for fresh installs
//   4. Update the field reference and JSON example in docs/configuration.md
//   5. Check the release checklist in docs/BEFORE-EVERY-RELEASE.md — Section 6
//
// Do NOT bump CURRENT_CONFIG_VERSION for bug fixes, new CLI flags, or anything
// that does not change the structure of allycat.config.json.
// -----------------------------------------------------------------------------

/**
 * Migrate a config object from any prior version up to CURRENT_CONFIG_VERSION.
 * Each version block is additive and runs in order on a single pass.
 *
 * HOW TO ADD A MIGRATION:
 *   1. Bump CURRENT_CONFIG_VERSION in src/constants.js
 *   2. Add an `if (from < N)` block below with the schema transformation
 *   3. Update DEFAULT_CONFIG if the new key needs a default for fresh installs
 *
 * @param {Object} raw - Raw config from disk (may lack configVersion)
 * @returns {Object} - Config stamped at CURRENT_CONFIG_VERSION
 */
function migrateConfig(raw) {
    let config = { ...raw };
    const from = config.configVersion ?? 0;

    // v0 → v1: configVersion field introduced; no schema changes.
    // if (from < 1) { /* nothing to transform */ }

    // v1 → v2: add data transforms here when the next schema change lands.

    // Stamp unconditionally so individual blocks never need to manage bookkeeping.
    // A forgotten stamp would cause re-migration on every load.
    config.configVersion = CURRENT_CONFIG_VERSION;
    return config;
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

    let raw;
    try {
        raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch {
        console.error(
            `[allycat] Config file is not valid JSON — run \`allycat init\` to reset it.\n` +
            `  Path: ${path.relative(process.cwd(), configPath)}`
        );
        return { ...sanitizeConfig(DEFAULT_CONFIG, scanMode), configIsDefault: true };
    }

    const version = raw.configVersion ?? 0;

    if (version > CURRENT_CONFIG_VERSION) {
        console.warn(
            `[allycat] Your config was created by a newer version of allycat ` +
            `(config v${version}, this tool supports v${CURRENT_CONFIG_VERSION}).\n` +
            `  Some settings may be ignored. Update allycat: npm install -g allycat`
        );
        return { ...sanitizeConfig(raw, scanMode), configIsDefault: false };
    }

    if (version < CURRENT_CONFIG_VERSION) {
        const migrated = migrateConfig(raw);
        saveConfig(migrated);
        // First-time stamp only (v0→v1): no schema changes, no action needed from the user.
        // Any later migration means real field changes happened — tell them to review.
        if (version === 0 && CURRENT_CONFIG_VERSION === 1) {
            console.log(`[allycat] Config updated to v1 — your settings are unchanged.`);
        } else {
            console.log(
                `[allycat] Config migrated from v${version} → v${CURRENT_CONFIG_VERSION}. ` +
                `Run \`allycat init\` to review your settings.`
            );
        }
        return { ...sanitizeConfig(migrated, scanMode), configIsDefault: false };
    }

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