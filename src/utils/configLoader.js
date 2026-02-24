/**
 * Configuration Loader
 * 
 * Shared utilities for loading and validating a11y-guard configuration.
 * Used by scan, and potentially future commands (fix, report, etc.)
 * 
 * @module utils/configLoader
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { CONFIG_FILE_NAME } from '../constants.js';

// -----------------------------------------------------------------------------
// Config Sanitization
// -----------------------------------------------------------------------------

const MEMORY_PER_SLOT = {
    quick: 150 * 1024 * 1024,  // ~150MB per JSDOM instance
    full:  500 * 1024 * 1024   // ~500MB per Playwright/Chromium instance
};

const SAFE_RAM_RATIO = 0.6; // Never use more than 60% of system RAM
const ABSOLUTE_MAX   = 50;  // Hard ceiling regardless of RAM
const ABSOLUTE_MIN   = 1;

/**
 * Compute a safe concurrency ceiling based on available system RAM.
 * 
 * Uses 60% of total RAM divided by memory cost per slot for the given mode.
 * Result is clamped between 1 and 50 regardless of machine size.
 *
 * @param {'quick'|'full'} scanMode
 * @returns {number}
 */
export function getSafeConcurrencyCeiling(scanMode = 'quick') {
    const totalRam   = os.totalmem();
    const usableRam  = totalRam * SAFE_RAM_RATIO;
    const memPerSlot = MEMORY_PER_SLOT[scanMode] ?? MEMORY_PER_SLOT.quick;
    const computed   = Math.floor(usableRam / memPerSlot);
    return Math.min(Math.max(computed, ABSOLUTE_MIN), ABSOLUTE_MAX);
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
    const ceiling  = getSafeConcurrencyCeiling(scanMode);
    const defaults = { quick: 5, full: 3 };
    const fallback = defaults[scanMode] ?? 5;
    const parsed   = parseInt(raw, 10);
    const valid    = !isNaN(parsed) && parsed >= ABSOLUTE_MIN;
    const clamped  = valid ? Math.min(parsed, ceiling) : fallback;

    if (valid && parsed > ceiling) {
        console.warn(
            `[a11y-guard] performance.concurrency "${parsed}" exceeds safe limit ` +
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
            concurrency: clampConcurrency(raw?.performance?.concurrency, scanMode)
        }
    };
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Load configuration from the project root.
 * Sanitizes and clamps all numeric values before returning.
 *
 * @param {'quick'|'full'} scanMode - Used to compute safe concurrency ceiling
 * @returns {Object|null} - Configuration object or null if not found
 */
export function loadConfig(scanMode = 'quick') {
    const configPath = getConfigPath();

    if (!fs.existsSync(configPath)) {
        return null;
    }

    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return sanitizeConfig(raw, scanMode);
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