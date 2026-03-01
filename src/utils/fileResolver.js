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
import { normalizeForGlob } from './pathUtils.js';

/**
 * All file types the scanner supports.
 * Scan method (HTML / JSX / Vue / Angular) is determined at runtime by each transformer.
 * 'component.ts' matches *.component.ts — Angular inline template files.
 */
export const SUPPORTED_EXTENSIONS = ['html', 'jsx', 'tsx', 'vue', 'component.ts'];

/**
 * Resolve the list of files to scan.
 *
 * @param {Object} config - User configuration
 * @param {string|null} targetPath - Optional specific file or directory
 * @returns {Promise<string[]>} - Resolved file paths
 */
export async function resolveFiles(config, targetPath) {
    if (targetPath) {
        return await resolveTargetPath(targetPath, SUPPORTED_EXTENSIONS);
    }

    const patterns = SUPPORTED_EXTENSIONS.map(ext => `**/*.${ext}`);
    const files = await glob(patterns, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        dot: false
    });

    return files;
}

export async function resolveTargetPath(targetPath, extensions) {
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
        return await glob(globPattern, {
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
        });
    }

    return [];
}
