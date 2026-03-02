/**
 * Path Utilities
 *
 * Cross-platform path handling for consistent behavior
 * across Windows and Unix environments.
 *
 * @module utils/pathUtils
 */

import os from 'os';

/**
 * Normalize path separators to forward slashes
 * 
 * Converts Windows-style backslashes to Unix-style forward slashes.
 * This ensures consistent behavior with glob patterns and Node.js APIs.
 * 
 * @param {string} inputPath - Path that may contain backslashes
 * @returns {string} - Path with forward slashes only
 * 
 * @example
 * normalizePathSeparators('.\\src\\components')
 * // Returns: './src/components'
 */
export function normalizePathSeparators(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
        return inputPath;
    }

    return inputPath.replace(/\\/g, '/');
}

/**
 * Remove trailing slashes from path
 * 
 * @param {string} inputPath - Path that may have trailing slashes
 * @returns {string} - Path without trailing slashes
 * 
 * @example
 * removeTrailingSlash('./src/')
 * // Returns: './src'
 */
export function removeTrailingSlash(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
        return inputPath;
    }

    return inputPath.replace(/\/+$/, '');
}

/**
 * Normalize path for glob pattern usage
 * 
 * Combines separator normalization and trailing slash removal
 * for consistent glob pattern construction.
 * 
 * @param {string} inputPath - Raw path from user input
 * @returns {string} - Normalized path safe for glob patterns
 * 
 * @example
 * normalizeForGlob('.\\src\\')
 * // Returns: './src'
 */
export function normalizeForGlob(inputPath) {
    const normalized = normalizePathSeparators(inputPath);
    return removeTrailingSlash(normalized);
}

/**
 * Expand and sanitize user-supplied path before resolution.
 *
 * Handles two cases that path.resolve() cannot fix on its own:
 *   - `~/foo`  → expands tilde to the user's home directory
 *   - `/foo`   → on Windows, a bare leading slash resolves to the drive root
 *               (C:\foo) instead of the project folder. Strip it so that
 *               path.resolve(cwd, 'foo') gives the expected result.
 *
 * @param {string} inputPath - Raw path from CLI argument
 * @returns {string} - Path safe to pass to path.resolve()
 */
export function expandUserPath(inputPath) {
    if (!inputPath || typeof inputPath !== 'string') {
        return inputPath;
    }

    // Expand ~/  or  ~ alone
    if (inputPath.startsWith('~/') || inputPath === '~') {
        return inputPath.replace(/^~/, os.homedir());
    }

    // On Windows, /foo resolves to the drive root — strip the leading slash
    // so it becomes a relative path and path.resolve(cwd, ...) works correctly.
    // Leave UNC paths (//server/share) and drive-letter paths (C:/) untouched.
    if (process.platform === 'win32' && /^\/[^/]/.test(inputPath)) {
        return inputPath.replace(/^\/+/, '');
    }

    return inputPath;
}
