/**
 * File Resolver
 *
 * Resolves which files to scan based on config targets or glob patterns.
 * Supports HTML, JSX, and TSX file extensions.
 *
 * @module utils/fileResolver
 */

import { glob } from 'glob';
import { statSync, existsSync, readFileSync } from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { normalizeForGlob, expandUserPath, resolveExcludePatterns, scopeExcludesTo } from './pathUtils.js';
import { SUPPORTED_EXTENSIONS, NEVER_SCAN, ALLYCATIGNORE_FILE } from '../constants.js';

export { SUPPORTED_EXTENSIONS };

/**
 * Read and parse .allycatignore from the project root.
 * Returns an empty array if the file does not exist.
 *
 * @param {string} root - Directory to look in (defaults to cwd)
 * @returns {string[]} - Raw glob patterns, comments and blank lines stripped
 */
export function loadIgnoreFile(root = process.cwd()) {
    const ignorePath = path.join(root, ALLYCATIGNORE_FILE);
    if (!existsSync(ignorePath)) return [];
    return readFileSync(ignorePath, 'utf8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
}

/**
 * Resolve the list of files to scan.
 *
 * @param {Object} config - User configuration
 * @param {string|null} targetPath - Optional specific file or directory
 * @returns {Promise<string[]>} - Resolved file paths
 */
export async function resolveFiles(config, targetPath, excludes = [], ignoreFilePatterns = []) {
    if (targetPath) {
        return await resolveTargetPath(targetPath, SUPPORTED_EXTENSIONS, excludes, ignoreFilePatterns);
    }

    const ignore = [
        ...NEVER_SCAN,
        ...resolveExcludePatterns(excludes),
        ...resolveExcludePatterns(ignoreFilePatterns),
    ];

    const patterns = SUPPORTED_EXTENSIONS.map(ext => `**/*.${ext}`);
    const files = await glob(patterns, { ignore, dot: false });

    return files;
}

export async function resolveTargetPath(targetPath, extensions, excludes = [], ignoreFilePatterns = []) {
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

        const scopedExcludes = scopeExcludesTo(excludes, targetPath);

        const ignore = [
            ...NEVER_SCAN,
            ...resolveExcludePatterns(scopedExcludes),
            ...resolveExcludePatterns(ignoreFilePatterns),
        ];
        return await glob(globPattern, { ignore });
    }

    return [];
}
