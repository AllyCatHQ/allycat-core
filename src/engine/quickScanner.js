/**
 * Quick Scanner - JSDOM-based accessibility auditing
 * 
 * Fast scanning using JSDOM + axe-core.
 * Does NOT check color contrast (requires real browser).
 * 
 * Enhanced with:
 * - Element selectors
 * - HTML snippets
 * - Approximate line numbers
 * 
 * Use for: Development, quick checks, CI fast-fail
 */

import { glob } from 'glob';
import fs from 'fs/promises';
import { readFileSync, statSync } from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createRequire } from 'module';
import * as p from '@clack/prompts';
import path from 'path';
import { findLineNumber } from '../utils/sourceMapper.js';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Main quick audit entry point
 * 
 * @param {Object} config - User configuration from a11y-config.json
 * @param {string} config.framework - Project framework (react, vue, angular, html)
 * @param {string} config.selectedStandard - Accessibility standard (israel, wcag-aa, wcag-aaa)
 * @param {Object} config.rules - Rule settings including RTL
 * @param {string|null} targetPath - Optional specific file/folder to scan
 * @returns {Promise<Array>} - Array of violation objects
 */
export async function runQuickAudit(config, targetPath = null) {
    const filesToScan = await resolveFiles(config, targetPath);

    if (filesToScan.length === 0) {
        p.log.warn('No matching files found to scan.');
        return [];
    }

    p.log.info(`Found ${filesToScan.length} file${filesToScan.length > 1 ? 's' : ''} to scan.`);

    const allViolations = [];

    for (const filePath of filesToScan) {
        const fileViolations = await scanSingleFile(filePath, config);
        allViolations.push(...fileViolations);
    }

    return allViolations;
}

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
async function resolveFiles(config, targetPath) {
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
function getFrameworkExtensions(framework) {
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
async function resolveTargetPath(targetPath, extensions) {
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
function getAxeTags(config) {
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
// JSDOM Setup
// -----------------------------------------------------------------------------

/**
 * Create a quiet virtual console that suppresses JSDOM warnings
 * 
 * @returns {VirtualConsole} - Configured virtual console
 */
function createSilentVirtualConsole() {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('error', () => { });
    virtualConsole.on('warn', () => { });
    return virtualConsole;
}

/**
 * Create JSDOM instance with axe-core injected
 * 
 * @param {string} htmlContent - HTML content to parse
 * @returns {Object} - JSDOM window object with axe-core available
 */
function createJsdomWithAxe(htmlContent) {
    const dom = new JSDOM(htmlContent, {
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        virtualConsole: createSilentVirtualConsole()
    });

    const { window } = dom;

    // Inject axe-core into virtual browser
    window.eval(axeSource);

    return window;
}

/**
 * Run axe-core analysis on document
 * 
 * @param {Object} window - JSDOM window object
 * @param {Object} config - User configuration
 * @returns {Promise<Object>} - Axe analysis results
 */
async function executeAxeAnalysis(window, config) {
    return await window.axe.run(window.document, {
        runOnly: {
            type: 'tag',
            values: getAxeTags(config)
        },
        rules: {
            // Contrast rules disabled - they don't work in JSDOM
            'color-contrast': { enabled: false },
            'color-contrast-enhanced': { enabled: false }
        },
        reporter: 'v2'
    });
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
function createViolationFromNode(filePath, violation, node, sourceContent) {
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
function processAxeViolations(filePath, violations, sourceContent) {
    const results = [];

    for (const violation of violations) {
        for (const node of violation.nodes) {
            const violationResult = createViolationFromNode(filePath, violation, node, sourceContent);
            results.push(violationResult);
        }
    }

    return results;
}

// -----------------------------------------------------------------------------
// Israeli Standard Compliance
// -----------------------------------------------------------------------------

/**
 * Check RTL compliance for Israeli accessibility standard
 * 
 * @param {Object} document - JSDOM document object
 * @param {string} filePath - Source file path
 * @param {string} sourceContent - Original source code
 * @returns {Object|null} - RTL violation object or null if compliant
 */
function checkIsraeliRtlCompliance(document, filePath, sourceContent) {
    const htmlElement = document.documentElement;
    const hasRtlDirection = htmlElement && htmlElement.getAttribute('dir') === 'rtl';

    if (hasRtlDirection) {
        return null;
    }

    const lineNumber = findLineNumber(sourceContent, '<html');
    const htmlOpenTag = htmlElement
        ? htmlElement.outerHTML.split('>')[0] + '>'
        : '<html>';

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

// -----------------------------------------------------------------------------
// File Scanning
// -----------------------------------------------------------------------------

/**
 * Scan a single file for accessibility issues
 * 
 * @param {string} filePath - File path to scan
 * @param {Object} config - User configuration
 * @returns {Promise<Array>} - Array of violation objects for this file
 */
async function scanSingleFile(filePath, config) {
    const violations = [];

    try {
        const sourceContent = await fs.readFile(filePath, 'utf8');

        const window = createJsdomWithAxe(sourceContent);

        const axeResults = await executeAxeAnalysis(window, config);

        const axeViolations = processAxeViolations(filePath, axeResults.violations, sourceContent);
        violations.push(...axeViolations);

        // Check Israeli RTL compliance if enabled
        if (config.rules.rtl) {
            const rtlViolation = checkIsraeliRtlCompliance(window.document, filePath, sourceContent);
            if (rtlViolation) {
                violations.push(rtlViolation);
            }
        }

        window.close();

    } catch (error) {
        p.log.error(`Error scanning ${filePath}: ${error.message}`);
    }

    return violations;
}