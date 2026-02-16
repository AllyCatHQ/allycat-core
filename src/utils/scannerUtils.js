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
    const globPattern = `**/*.{${extensions.join(',')}}`;
    return await glob(globPattern, {
        ignore: ['node_modules/**', 'dist/**', 'build/**']
    });
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
        const globPattern = `${targetPath}/**/*.{${extensions.join(',')}}`;
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
 * Create a single violation result object from axe node data
 * 
 * @param {string} filePath - Source file path
 * @param {Object} violation - Axe violation object
 * @param {Object} node - Affected DOM node from axe
 * @param {string} sourceContent - Original source code for line lookup
 * @returns {Object} - Formatted violation result
 */
export function createViolationFromNode(filePath, violation, node, sourceContent) {
    const htmlSnippet = node.html;
    const cssSelector = node.target?.[0] || '';
    const lineNumber = findLineNumber(sourceContent, htmlSnippet);

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
 * @returns {Array} - Array of formatted violation results
 */
export function processAxeViolations(filePath, violations, sourceContent) {
    const results = [];

    for (const violation of violations) {
        for (const node of violation.nodes) {
            const violationResult = createViolationFromNode(filePath, violation, node, sourceContent);
            results.push(violationResult);
        }
    }

    return results;
}