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

/**
 * Main quick audit entry point
 * @param {Object} config - User configuration
 * @param {string|null} targetPath - Optional specific file/folder to scan
 */
export async function runQuickAudit(config, targetPath = null) {
    const files = await resolveFiles(config, targetPath);

    if (files.length === 0) {
        p.log.warn('No matching files found to scan.');
        return [];
    }

    p.log.info(`Found ${files.length} file${files.length > 1 ? 's' : ''} to scan.`);

    const allResults = [];

    for (const file of files) {
        const results = await scanFile(file, config);
        allResults.push(...results);
    }

    return allResults;
}

/**
 * Resolve which files to scan based on target path or config
 */
async function resolveFiles(config, targetPath) {
    const extensions = getExtensions(config.framework);

    if (targetPath) {
        return await resolveTargetPath(targetPath, extensions);
    }

    // Default: scan entire project
    const pattern = `**/*.{${extensions.join(',')}}`;
    return await glob(pattern, {
        ignore: ['node_modules/**', 'dist/**', 'build/**']
    });
}

/**
 * Get file extensions based on framework
 */
function getExtensions(framework) {
    switch (framework) {
        case 'react':
            return ['jsx', 'tsx', 'html'];
        case 'vue':
            return ['vue', 'html'];
        case 'angular':
            return ['html', 'component.html'];
        case 'html':
        default:
            return ['html'];
    }
}

/**
 * Resolve a specific target path (file or directory)
 */
async function resolveTargetPath(targetPath, extensions) {
    const stats = statSync(targetPath);

    if (stats.isFile()) {
        const ext = path.extname(targetPath).slice(1);
        if (!extensions.includes(ext)) {
            p.log.warn(`File extension .${ext} not in expected list: ${extensions.join(', ')}`);
        }
        return [targetPath];
    }

    if (stats.isDirectory()) {
        const pattern = `${targetPath}/**/*.{${extensions.join(',')}}`;
        return await glob(pattern, {
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
        });
    }

    return [];
}

/**
 * Get axe-core tags based on user's selected standard
 */
function getAxeTags(config) {
    const tags = ['best-practice'];

    switch (config.selectedStandard) {
        case 'israel':
            tags.push('wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa');
            break;

        case 'wcag-aaa':
            tags.push(
                'wcag2a', 'wcag2aa', 'wcag2aaa',
                'wcag21a', 'wcag21aa', 'wcag21aaa'
            );
            break;

        case 'wcag-aa':
        default:
            tags.push('wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa');
            break;
    }

    return tags;
}

/**
 * Create a quiet virtual console (suppresses JSDOM warnings)
 */
function createQuietConsole() {
    const vc = new VirtualConsole();
    vc.on('error', () => { });
    vc.on('warn', () => { });
    return vc;
}

/**
 * Create JSDOM instance with axe-core injected
 * @param {string} content - HTML content to parse
 * @returns {Object} - JSDOM window object
 */
function createJsdomInstance(content) {
    const dom = new JSDOM(content, {
        runScripts: 'dangerously',
        resources: 'usable',
        pretendToBeVisual: true,
        virtualConsole: createQuietConsole()
    });

    const { window } = dom;

    // Inject axe-core into virtual browser
    window.eval(axeSource);

    return window;
}

/**
 * Run axe-core analysis on document
 * @param {Object} window - JSDOM window object
 * @param {Object} config - User configuration
 * @returns {Promise<Object>} - Axe results
 */
async function runAxeAnalysis(window, config) {
    return await window.axe.run(window.document, {
        runOnly: {
            type: 'tag',
            values: getAxeTags(config)
        },
        rules: {
            'color-contrast': { enabled: false },
            'color-contrast-enhanced': { enabled: false }
        },
        reporter: 'v2'
    });
}

/**
 * Create a single violation result object
 * @param {string} file - Source file path
 * @param {Object} violation - Axe violation object
 * @param {Object} node - Affected DOM node
 * @param {string} sourceContent - Original source code
 * @returns {Object} - Formatted violation result
 */
function createViolationResult(file, violation, node, sourceContent) {
    const htmlSnippet = node.html;
    const selector = node.target?.[0] || '';
    const lineNumber = findLineNumber(sourceContent, htmlSnippet);

    return {
        file,
        id: violation.id,
        impact: violation.impact || 'minor',
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        wcagTags: violation.tags.filter(t => t.startsWith('wcag')),
        selector,
        html: htmlSnippet,
        lineNumber,
        failureSummary: node.failureSummary,
    };
}

/**
 * Process axe violations into result objects
 * @param {string} file - Source file path
 * @param {Array} violations - Axe violations array
 * @param {string} sourceContent - Original source code
 * @returns {Array} - Formatted violation results
 */
function processViolations(file, violations, sourceContent) {
    const results = [];

    for (const violation of violations) {
        for (const node of violation.nodes) {
            const result = createViolationResult(file, violation, node, sourceContent);
            results.push(result);
        }
    }

    return results;
}

/**
 * Check RTL compliance for Israeli standard
 * @param {Object} document - JSDOM document object
 * @param {string} file - Source file path
 * @param {string} sourceContent - Original source code
 * @returns {Object|null} - RTL violation or null
 */
function checkRtlCompliance(document, file, sourceContent) {
    const htmlTag = document.documentElement;
    const hasRtlDir = htmlTag && htmlTag.getAttribute('dir') === 'rtl';

    if (!hasRtlDir) {
        const lineNumber = findLineNumber(sourceContent, '<html');

        return {
            file,
            id: 'israel-rtl',
            impact: 'serious',
            description: 'Israeli law requires RTL direction for Hebrew interfaces.',
            help: 'Add dir="rtl" to your <html> tag.',
            helpUrl: 'https://www.gov.il/he/departments/policies/accessibility_standard',
            wcagTags: ['israeli-standard'],
            selector: 'html',
            html: htmlTag ? htmlTag.outerHTML.split('>')[0] + '>' : '<html>',
            lineNumber,
        };
    }

    return null;
}

/**
 * Scan a single file for accessibility issues
 * @param {string} file - File path to scan
 * @param {Object} config - User configuration
 * @returns {Promise<Array>} - Array of violations
 */
async function scanFile(file, config) {
    const results = [];

    try {
        const content = await fs.readFile(file, 'utf8');

        const window = createJsdomInstance(content);

        const axeResults = await runAxeAnalysis(window, config);

        const violations = processViolations(file, axeResults.violations, content);
        results.push(...violations);

        if (config.rules.rtl) {
            const rtlViolation = checkRtlCompliance(window.document, file, content);
            if (rtlViolation) {
                results.push(rtlViolation);
            }
        }

        window.close();

    } catch (err) {
        p.log.error(`Error scanning ${file}: ${err.message}`);
    }

    return results;
}