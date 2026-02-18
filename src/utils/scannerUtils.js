/**
 * Scanner Utilities
 * 
 * Shared utilities for both quick and full scanners.
 * Contains file resolution, axe-core configuration, and compliance checks.
 * 
 * @module utils/scannerUtils
 */

import { glob } from 'glob';
import { statSync } from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { findLineNumber } from './sourceMapper.js';
import { normalizeForGlob } from './pathUtils.js';
import { HTML_WRAPPER_OFFSET } from '../engine/transformers/jsxTransformer.js';

// -----------------------------------------------------------------------------
// File Resolution
// -----------------------------------------------------------------------------

/**
 * Resolve which files to scan based on target path or config
 * 
 * @param {Object} config - User configuration
 * @param {string|null} targetPath - Optional target path
 * @returns {Promise<Array<string>>} - Array of file paths to scan
 */
export async function resolveFiles(config, targetPath) {
    const extensions = getFrameworkExtensions(config.framework);

    if (targetPath) {
        return await resolveTargetPath(targetPath, extensions);
    }

    // Default: scan entire project
    // Use multiple patterns to ensure root-level files are included
    const patterns = extensions.map(ext => `**/*.${ext}`);
    
    const files = await glob(patterns, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        dot: false
    });

    return files;
}

/**
 * Get file extensions based on framework type
 * 
 * @param {string} framework - Framework identifier
 * @returns {Array<string>} - Array of file extensions without dots
 */
export function getFrameworkExtensions(framework) {
    const extensionMap = {
        'react': ['jsx', 'tsx', 'html'],
        'vue': ['vue', 'html'],
        'angular': ['html', 'component.html'],
        'html': ['html']
    };

    return extensionMap[framework] || extensionMap['html'];
}

/**
 * Resolve a specific target path (file or directory)
 * 
 * @param {string} targetPath - Path to file or directory
 * @param {Array<string>} extensions - Valid file extensions
 * @returns {Promise<Array<string>>} - Array of resolved file paths
 */
export async function resolveTargetPath(targetPath, extensions) {
    const stats = statSync(targetPath);

    if (stats.isFile()) {
        const fileExtension = path.extname(targetPath).slice(1);
        if (!extensions.includes(fileExtension)) {
            p.log.warn(`File extension .${fileExtension} not in expected list: ${extensions.join(', ')}`);
        }
        return [targetPath];
    }

    if (stats.isDirectory()) {
        // Normalize path separators for cross-platform glob compatibility
        const normalizedPath = normalizeForGlob(targetPath);
        const globPattern = `${normalizedPath}/**/*.{${extensions.join(',')}}`;
        return await glob(globPattern, {
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
        });
    }

    return [];
}

// -----------------------------------------------------------------------------
// Axe-Core Configuration
// -----------------------------------------------------------------------------

/**
 * Get axe-core tags based on user's selected accessibility standard
 * 
 * @param {Object} config - User configuration
 * @returns {Array<string>} - Array of axe-core tag identifiers
 */
export function getAxeTags(config) {
    const baseTags = ['best-practice'];

    const standardTagMap = {
        'israel': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        'wcag-aaa': ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
        'wcag-aa': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
    };

    const standardTags = standardTagMap[config.selectedStandard] || standardTagMap['wcag-aa'];

    return [...baseTags, ...standardTags];
}

// -----------------------------------------------------------------------------
// Israeli Standard Compliance
// -----------------------------------------------------------------------------

/**
 * Create an Israeli RTL compliance violation object
 * 
 * @param {string} filePath - Source file path
 * @param {string} htmlOpenTag - The HTML opening tag snippet
 * @param {number|null} lineNumber - Line number of the HTML tag
 * @returns {Object} - RTL violation object
 */
export function createRtlViolation(filePath, htmlOpenTag, lineNumber) {
    return {
        file: filePath,
        id: 'israel-rtl',
        impact: 'serious',
        description: 'Israeli law requires RTL direction for Hebrew interfaces.',
        help: 'Add dir="rtl" to your <html> tag.',
        helpUrl: 'https://www.gov.il/he/departments/policies/accessibility_standard',
        wcagTags: ['israeli-standard'],
        selector: 'html',
        html: htmlOpenTag,
        lineNumber,
    };
}

/**
 * Check RTL compliance for Israeli accessibility standard
 * 
 * @param {Object} document - DOM document object (JSDOM or Playwright)
 * @param {string} filePath - Source file path
 * @param {string} sourceContent - Original source code
 * @param {string} htmlOpenTag - The HTML opening tag snippet
 * @returns {Object|null} - RTL violation object or null if compliant
 */
export function checkIsraeliRtlCompliance(document, filePath, sourceContent, htmlOpenTag) {
    const htmlElement = document.documentElement;
    const hasRtlDirection = htmlElement && htmlElement.getAttribute('dir') === 'rtl';

    if (hasRtlDirection) {
        return null;
    }

    const lineNumber = findLineNumber(sourceContent, '<html');

    return createRtlViolation(filePath, htmlOpenTag, lineNumber);
}

// -----------------------------------------------------------------------------
// Violation Processing
// -----------------------------------------------------------------------------

/**
 * Resolve the source line number for a violation.
 *
 * For JSX files: uses lineMap (Babel AST precision) + transformedHtml for snippet lookup.
 * For HTML files: falls back to pattern matching in source content.
 *
 * @param {string} htmlSnippet - HTML snippet from axe-core
 * @param {string} sourceContent - Original source code
 * @param {Map<number, number>|null} lineMap - Optional JSX htmlLine→sourceLine map
 * @param {string|null} transformedHtml - Optional transformed HTML (required when lineMap is set)
 * @returns {number|null}
 */
function resolveLineNumber(htmlSnippet, sourceContent, lineMap, transformedHtml) {
    if (lineMap && lineMap.size > 0 && transformedHtml) {
        return resolveLineFromMap(htmlSnippet, lineMap, transformedHtml);
    }
    return findLineNumber(sourceContent, htmlSnippet);
}
/**
 * Find the original JSX source line using the transformer's lineMap.
 *
 * Strategy:
 *  - Extract tag name from the axe snippet (e.g. "img" from '<img src="dynamic">')
 *  - Walk lineMap entries (which are keyed to transformed HTML body lines)
 *  - Add HTML_WRAPPER_OFFSET to convert body-relative line → full document line
 *  - Find the transformed HTML line that contains a matching opening tag
 *  - Return the mapped JSX source line
 *
 * @param {string} htmlSnippet - HTML snippet from axe (e.g. '<img src="dynamic">')
 * @param {Map<number, number>} lineMap - bodyLine → jsxSourceLine (1-indexed, body-relative)
 * @param {string} transformedHtml - Full HTML output from the transformer
 * @returns {number|null}
 */
function resolveLineFromMap(htmlSnippet, lineMap, transformedHtml) {
    const tagName = extractTagName(htmlSnippet);
    if (!tagName) return null;

    const htmlLines = transformedHtml.split('\n');

    for (const [bodyLine, sourceLine] of lineMap.entries()) {
        // bodyLine is 1-indexed relative to body content
        // add offset to get the actual line in the full document string
        const documentLine = bodyLine + HTML_WRAPPER_OFFSET;
        const htmlLine = htmlLines[documentLine - 1]; // convert to 0-indexed

        if (!htmlLine) continue;

        const lineTagName = extractTagName(htmlLine);
        if (lineTagName === tagName) {
            return sourceLine;
        }
    }

    return null;
}

/**
 * Extract the opening tag name from an HTML string.
 * Works on full elements, single lines, and axe snippets.
 *
 * @param {string} html
 * @returns {string|null} - Lowercase tag name, or null if not found
 */
function extractTagName(html) {
    const match = html.match(/<(\w+)[\s>]/);
    return match ? match[1].toLowerCase() : null;
}

/**
 * Create a single violation result object from axe node data
 *
 * @param {string} filePath - Source file path
 * @param {Object} violation - Axe violation object
 * @param {Object} node - Affected DOM node from axe
 * @param {string} sourceContent - Original source code for line lookup
 * @param {Map<number, number>|null} lineMap - Optional JSX lineMap
 * @param {string|null} transformedHtml - Optional transformed HTML for JSX line resolution
 * @returns {Object} - Formatted violation result
 */
export function createViolationFromNode(filePath, violation, node, sourceContent, lineMap = null, transformedHtml = null) {
    const htmlSnippet = node.html;
    const cssSelector = node.target?.[0] || '';
    const lineNumber = resolveLineNumber(htmlSnippet, sourceContent, lineMap, transformedHtml);

    return {
        file: filePath,
        id: violation.id,
        impact: violation.impact || 'minor',
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        wcagTags: violation.tags.filter(tag => tag.startsWith('wcag')),
        selector: cssSelector,
        html: htmlSnippet,
        lineNumber,
        failureSummary: node.failureSummary,
    };
}

/**
 * Process all axe violations into formatted result objects
 *
 * @param {string} filePath - Source file path
 * @param {Array} violations - Array of axe violation objects
 * @param {string} sourceContent - Original source code
 * @param {Map<number, number>|null} lineMap - Optional JSX lineMap
 * @param {string|null} transformedHtml - Optional transformed HTML for JSX line resolution
 * @returns {Array} - Array of formatted violation results
 */
export function processAxeViolations(filePath, violations, sourceContent, lineMap = null, transformedHtml = null) {
    const results = [];

    for (const violation of violations) {
        for (const node of violation.nodes) {
            const violationResult = createViolationFromNode(
                filePath, violation, node, sourceContent, lineMap, transformedHtml
            );
            results.push(violationResult);
        }
    }

    return results;
}

