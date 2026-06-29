/**
 * Path Utilities
 *
 * Cross-platform path handling for consistent behavior
 * across Windows and Unix environments.
 *
 * @module utils/pathUtils
 */

import os from 'os';
import path from 'path';
import { NEVER_SCAN } from '../constants.js';

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

/**
 * Normalize user-supplied exclude paths into glob-ready patterns.
 *
 * Plain paths  → ['tests', 'tests/**']  (exclude folder and its contents)
 * Glob patterns → passed through as-is
 *
 * @param {string[]} userPaths - Raw paths/globs from --exclude
 * @returns {string[]} - Expanded glob patterns ready for the ignore list
 */
export function resolveExcludePatterns(userPaths = []) {
    return userPaths.flatMap(p => {
        const normalized = normalizeForGlob(expandUserPath(p));
        const isGlob = /[*?{}\[\]!]/.test(normalized);
        return isGlob ? [normalized] : [normalized, `${normalized}/**`];
    });
}

/**
 * Scope plain exclude paths to a target directory.
 *
 * When the user scans a subdirectory and passes --exclude with a plain filename
 * (e.g. scan scripts --exclude test.html), the exclude must be resolved relative
 * to that target so the glob ignore list actually matches.
 *
 * Pass-through rules (path returned unchanged):
 *  - Absolute targets     — scoping doesn't apply
 *  - Glob patterns        — user wrote them explicitly, don't touch
 *  - Paths containing ../ — parent-traversal; don't transform
 *  - Already-prefixed     — would double-prefix otherwise
 *
 * @param {string[]} excludes   - Raw --exclude values from the CLI
 * @param {string}   targetPath - The scan target directory
 * @returns {string[]}
 */
export function scopeExcludesTo(excludes, targetPath) {
    if (!excludes.length || path.isAbsolute(targetPath)) return excludes;
    const normalizedTarget = normalizeForGlob(targetPath);
    return excludes.map(excl => {
        if (!excl) return excl;
        if (/[*?{}\[\]!]/.test(excl)) return excl;
        const norm = normalizeForGlob(expandUserPath(excl));
        if (norm.includes('../')) return excl;
        if (norm.startsWith(normalizedTarget + '/') || norm === normalizedTarget) return excl;
        return `${normalizedTarget}/${norm}`;
    });
}

/**
 * Returns true if a (relative, forward-slash) file path matches any resolved exclude pattern.
 * Handles both plain-path patterns (prefix match) and glob patterns (exact match only —
 * callers wanting full glob matching should pre-filter with resolveExcludePatterns + glob).
 *
 * @param {string}   filepath - Relative path with forward slashes
 * @param {string[]} patterns - Output of resolveExcludePatterns()
 * @returns {boolean}
 */
export function matchesExcludePatterns(filepath, patterns) {
    if (!patterns.length) return false;
    return patterns.some(pat => {
        if (pat.endsWith('/**')) return filepath.startsWith(pat.slice(0, -3) + '/');
        if (/[*?{}\[\]!]/.test(pat)) return false; // complex glob (e.g. **/*.min.js) — not matched here; glob() handles these during normal file resolution. --changed and watch-mode pre-filtering silently skip them.
        return filepath === pat || filepath.startsWith(pat + '/');
    });
}

/**
 * Filter a file list against NEVER_SCAN patterns.
 * Applied unconditionally to any pre-resolved file list so that system-level
 * exclusions (e.g. allycat-report.html, node_modules) are enforced regardless
 * of how the list was assembled (--changed, --staged, etc.).
 *
 * @param {string[]} files - Absolute or relative file paths
 * @returns {string[]} - Files with NEVER_SCAN matches removed
 */
// NEVER_SCAN patterns must follow one of two forms:
//   **/X/**  → file lives inside directory X at any depth
//   **/X     → file is named X at any depth
// If a more complex glob is ever added (e.g. **/*.min.js), add minimatch as a
// direct dependency and replace this logic with: minimatch(normalized, pattern)
export function filterNeverScan(files) {
    return files.filter(f => {
        const normalized = f.replace(/\\/g, '/');
        return !NEVER_SCAN.some(pattern => {
            if (pattern.startsWith('**/') && pattern.endsWith('/**')) {
                const seg = pattern.slice(3, -3);
                return normalized.startsWith(`${seg}/`) || normalized.includes(`/${seg}/`);
            }
            if (pattern.startsWith('**/')) {
                const suffix = pattern.slice(3);
                return normalized === suffix || normalized.endsWith(`/${suffix}`);
            }
            return false;
        });
    });
}
