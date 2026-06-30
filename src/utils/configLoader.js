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
import { CONFIG_FILE_NAME, SCAN_MODES, STANDARDS, AI_REPORT_BEHAVIORS, CURRENT_CONFIG_VERSION } from '../constants.js';
import { closestKey } from './stringUtils.js';

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

// Single source of truth for all valid allycat.config.json keys.
// Update here whenever DEFAULT_CONFIG or sanitizeConfig() gains or loses a key.
const TOP_LEVEL_KEYS = new Set([
    'selectedStandard', 'scan', 'rules', 'ai', 'performance', 'configVersion'
]);

const NESTED_KEYS = {
    scan:        new Set(['defaultMode']),
    rules:       new Set(['rtl', 'level']),
    ai:          new Set(['enabled', 'reportBehavior', 'agent']),
    performance: new Set(['concurrency']),
};

// -----------------------------------------------------------------------------
// Config Sanitization
// -----------------------------------------------------------------------------

const MEMORY_PER_SLOT = {
    [SCAN_MODES.QUICK]: 200 * 1024 * 1024,  // ~200MB per JSDOM instance (benchmarked: 163MB worst-case + 23% margin)
    [SCAN_MODES.FULL]:  500 * 1024 * 1024   // ~500MB per Playwright/Chromium instance (benchmarked: 413MB worst-case + 21% margin)
};

// loadConfig runs twice per scan (preliminary mode read + final load) and on
// every watch-mode rescan — without dedup, each config problem would warn
// once per load instead of once per process.
const warnedMessages = new Set();

function warnOnce(message) {
    if (warnedMessages.has(message)) return;
    warnedMessages.add(message);
    console.warn(message);
}

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
        warnOnce(
            `[allycat] performance.concurrency "${parsed}" exceeds safe limit ` +
            `for your system in ${scanMode} mode. Clamped to ${clamped}.`
        );
    }

    return clamped;
}

/**
 * Return raw if it is one of the allowed values; otherwise warn and return fallback.
 * Missing keys (undefined) fall back silently — only present-but-invalid values warn.
 * Warnings go to stderr (console.warn) so they surface in CI logs and never
 * corrupt JSON output written to stdout.
 *
 * @param {*} raw                    - Raw value from config
 * @param {string[]} allowedValues   - Valid values for this field
 * @param {string} fallback          - Default used when raw is missing or invalid
 * @param {string} fieldPath         - Dotted field name for the warning message
 * @returns {string}
 */
function validateEnum(raw, allowedValues, fallback, fieldPath) {
    if (raw === undefined || allowedValues.includes(raw)) return raw ?? fallback;
    warnOnce(
        `[allycat] ${fieldPath} "${raw}" is not a valid value — falling back to "${fallback}".\n` +
        `  Valid values: ${allowedValues.join(', ')}`
    );
    return fallback;
}

/**
 * Return raw if it is a real boolean; otherwise warn and return fallback.
 * Truthy strings like "yes" are rejected rather than coerced — coercion would
 * silently flip intent for values like the string "false".
 *
 * @param {*} raw                - Raw value from config
 * @param {boolean} fallback     - Default used when raw is missing or invalid
 * @param {string} fieldPath     - Dotted field name for the warning message
 * @returns {boolean}
 */
function validateBoolean(raw, fallback, fieldPath) {
    if (raw === undefined || typeof raw === 'boolean') return raw ?? fallback;
    warnOnce(`[allycat] ${fieldPath} "${raw}" is not true/false — falling back to ${fallback}.`);
    return fallback;
}

/**
 * Sanitize raw config loaded from disk.
 * Clamps concurrency to a RAM-aware safe ceiling, fills missing keys with
 * defaults, and replaces invalid enum/boolean values with their defaults
 * (warning to stderr) so downstream consumers — axe rule selection, scan
 * banner, reports, baseline — always agree on what actually ran.
 *
 * Corrections are in-memory only; the user's file is never rewritten.
 * Nested sections are rebuilt so DEFAULT_CONFIG's own objects are never
 * shared with (and mutable through) a returned config.
 *
 * @param {Object} raw      - Raw parsed JSON config
 * @param {'quick'|'full'} scanMode
 * @returns {Object}
 */
function sanitizeConfig(raw, scanMode) {
    return {
        ...DEFAULT_CONFIG,
        ...raw,
        selectedStandard: validateEnum(
            raw?.selectedStandard, Object.values(STANDARDS),
            DEFAULT_CONFIG.selectedStandard, 'selectedStandard'
        ),
        scan: {
            ...DEFAULT_CONFIG.scan,
            ...raw?.scan,
            defaultMode: validateEnum(
                raw?.scan?.defaultMode, Object.values(SCAN_MODES),
                DEFAULT_CONFIG.scan.defaultMode, 'scan.defaultMode'
            ),
        },
        rules: {
            ...DEFAULT_CONFIG.rules,
            ...raw?.rules,
            rtl: validateBoolean(raw?.rules?.rtl, DEFAULT_CONFIG.rules.rtl, 'rules.rtl'),
        },
        ai: {
            ...DEFAULT_CONFIG.ai,
            ...raw?.ai,
            enabled: validateBoolean(raw?.ai?.enabled, DEFAULT_CONFIG.ai.enabled, 'ai.enabled'),
            // reportBehavior has no entry in DEFAULT_CONFIG — absent stays absent
            // (reportOutputter applies its own ?? default), so only validate when present.
            ...(raw?.ai?.reportBehavior !== undefined && {
                reportBehavior: validateEnum(
                    raw.ai.reportBehavior, Object.values(AI_REPORT_BEHAVIORS),
                    AI_REPORT_BEHAVIORS.PATH_ONLY, 'ai.reportBehavior'
                ),
            }),
        },
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
 * Warn about unknown top-level and one-level-deep keys in a raw config object.
 * Provides "did you mean" suggestions for common typos.
 * Uses warnOnce so repeated loads (watch mode, dual-load in scan.js) never duplicate.
 *
 * @param {Object} raw - Raw parsed JSON config (pre-migration, pre-sanitization)
 */
export function validateConfigKeys(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;

    for (const key of Object.keys(raw)) {
        if (TOP_LEVEL_KEYS.has(key)) continue;
        const suggestion = closestKey(key, TOP_LEVEL_KEYS);
        warnOnce(suggestion
            ? `⚠  allycat.config.json: unknown key "${key}" — did you mean "${suggestion}"?`
            : `⚠  allycat.config.json: unknown key "${key}" (ignored)`
        );
    }

    for (const [section, knownKeys] of Object.entries(NESTED_KEYS)) {
        const nested = raw[section];
        if (!nested || typeof nested !== 'object' || Array.isArray(nested)) continue;
        for (const key of Object.keys(nested)) {
            if (knownKeys.has(key)) continue;
            const suggestion = closestKey(key, knownKeys);
            warnOnce(suggestion
                ? `⚠  allycat.config.json: unknown key "${section}.${key}" — did you mean "${section}.${suggestion}"?`
                : `⚠  allycat.config.json: unknown key "${section}.${key}" (ignored)`
            );
        }
    }
}

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
        raw = undefined;
    }

    // Guard against valid JSON that is not a config object (null, [], "text", 42).
    // null would crash property access below; arrays/scalars would be silently
    // rewritten as garbage objects by the migration save.
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        console.error(
            `[allycat] Config file is not a valid JSON object — run \`allycat init\` to reset it.\n` +
            `  Path: ${path.relative(process.cwd(), configPath)}`
        );
        return { ...sanitizeConfig(DEFAULT_CONFIG, scanMode), configIsDefault: true };
    }

    validateConfigKeys(raw);

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
        try {
            saveConfig(migrated);
        } catch {
            // Read-only file/dir (CI sandbox, locked checkout): migration still
            // applies in-memory; it will be re-attempted on the next load.
            console.warn(`[allycat] Could not write migrated config to disk — continuing with in-memory settings.`);
        }
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