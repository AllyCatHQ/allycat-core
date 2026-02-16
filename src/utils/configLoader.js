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

    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
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
