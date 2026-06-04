/**
 * File Resolver
 *
 * Resolves which files to scan based on config targets or glob patterns.
 * Supports HTML, JSX, and TSX file extensions.
 *
 * @module utils/fileResolver
 */

import { glob } from 'glob';
import { statSync } from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { normalizeForGlob, expandUserPath, resolveExcludePatterns } from './pathUtils.js';
import { SUPPORTED_EXTENSIONS } from '../constants.js';

export { SUPPORTED_EXTENSIONS };

/**
 * Resolve the list of files to scan.
 *
 * @param {Object} config - User configuration
 * @param {string|null} targetPath - Optional specific file or directory
 * @returns {Promise<string[]>} - Resolved file paths
 */
export async function resolveFiles(config, targetPath, excludes = []) {
    if (targetPath) {
        return await resolveTargetPath(targetPath, SUPPORTED_EXTENSIONS, excludes);
    }

    const ignore = [
        '**/node_modules/**', '**/dist/**', '**/build/**',
        ...resolveExcludePatterns(excludes)
    ];

    const patterns = SUPPORTED_EXTENSIONS.map(ext => `**/*.${ext}`);
    const files = await glob(patterns, { ignore, dot: false });

    return files;
}

export async function resolveTargetPath(targetPath, extensions, excludes = []) {
    const stats = statSync(targetPath);

    if (stats.isFile()) {
        const fileName = path.basename(targetPath);
        const isSupported = extensions.some(ext => fileName.endsWith(`.${ext}`));
        if (!isSupported) {
            p.log.warn(`File extension not in supported list: ${extensions.join(', ')}`);
        }
        return [targetPath];
    }

    if (stats.isDirectory()) {
        const normalizedPath = normalizeForGlob(targetPath);
        const globPattern = `${normalizedPath}/**/*.{${extensions.join(',')}}`;

        // When the target is a relative path, resolve plain exclude paths relative to it.
        // e.g. scan scripts --exclude test.html → treated as scripts/test.html
        // Glob patterns, already-prefixed paths, and absolute targets pass through unchanged.
        const scopedExcludes = path.isAbsolute(targetPath)
            ? excludes
            : excludes.map(excl => {
                if (/[*?{}\[\]!]/.test(excl)) return excl;
                const norm = normalizeForGlob(expandUserPath(excl));
                if (norm.startsWith(normalizedPath + '/') || norm === normalizedPath) return excl;
                return `${normalizedPath}/${norm}`;
            });

        const ignore = [
            '**/node_modules/**', '**/dist/**', '**/build/**',
            ...resolveExcludePatterns(scopedExcludes)
        ];
        return await glob(globPattern, { ignore });
    }

    return [];
}
