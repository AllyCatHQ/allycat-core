/**
 * Configuration Loader
 * 
 * Shared utilities for loading and validating a11y-guard configuration.
 * Used by scan, and potentially future commands (fix, report, etc.)
 * 
 * @module utils/configLoader
 */

import fs from 'fs';
import path from 'path';
import { CONFIG_FILE_NAME } from '../constants.js';

// -----------------------------------------------------------------------------
// Config Sanitization
// -----------------------------------------------------------------------------

/** Safe boundaries for numeric config values */
const CONFIG_BOUNDS = {
    performance: {
        concurrency: { min: 1, max: 20, default: 5 }
    }
};

/**
 * Clamp a numeric value within safe boundaries.
 * Returns the default if the value is missing, non-numeric, or out of range.
 *
 * @param {*} value - Raw value from config
 * @param {Object} bounds - { min, max, default }
 * @returns {number}
 */
function clampNumber(value, bounds) {
    const num = parseInt(value, 10);
    if (isNaN(num)) return bounds.default;
    return Math.min(Math.max(num, bounds.min), bounds.max);
}

/**
 * Sanitize raw config loaded from disk.
 * Clamps all numeric values to safe ranges and fills missing keys with defaults.
 *
 * @param {Object} raw - Raw parsed JSON config
 * @returns {Object} - Safe, validated config object
 */
function sanitizeConfig(raw) {
    const bounds = CONFIG_BOUNDS.performance.concurrency;

    const rawConcurrency = raw?.performance?.concurrency;
    const sanitizedConcurrency = clampNumber(rawConcurrency, bounds);

    if (rawConcurrency !== undefined && rawConcurrency !== sanitizedConcurrency) {
        console.warn(
            `[a11y-guard] performance.concurrency value "${rawConcurrency}" is out of range. ` +
            `Clamped to ${sanitizedConcurrency} (allowed: ${bounds.min}–${bounds.max}).`
        );
    }

    return {
        ...raw,
        performance: {
            ...raw?.performance,
            concurrency: sanitizedConcurrency
        }
    };
}

/**
 * Load configuration from the project root
 * 
 * @returns {Object|null} - Configuration object or null if not found
 */
export function loadConfig() {
    const configPath = getConfigPath();

    if (!fs.existsSync(configPath)) {
        return null;
    }

    const raw = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    return sanitizeConfig(raw);
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
