/**
 * Path Utilities
 * 
 * Cross-platform path handling for consistent behavior
 * across Windows and Unix environments.
 * 
 * @module utils/pathUtils
 */

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
