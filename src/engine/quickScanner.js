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

import fs from 'fs/promises';
import { readFileSync } from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createRequire } from 'module';
import * as p from '@clack/prompts';
import {
    resolveFiles,
    getAxeTags,
    checkIsraeliRtlCompliance,
    processAxeViolations
} from '../utils/scannerUtils.js';
import { transformJsxToHtml, isJsxFile } from './transformers/jsxTransformer.js';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Main quick audit entry point
 * 
 * @param {Object} config - User configuration from a11y-config.json
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
 * Run axe-core analysis on document (quick mode - no contrast)
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
// File Scanning
// -----------------------------------------------------------------------------

/**
 * Extract HTML opening tag from document
 * 
 * @param {Object} document - JSDOM document object
 * @returns {string} - HTML opening tag snippet
 */
function getHtmlOpenTag(document) {
    const htmlElement = document.documentElement;
    return htmlElement
        ? htmlElement.outerHTML.split('>')[0] + '>'
        : '<html>';
}

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

        // JSX/TSX: transform first, preserve lineMap for precise line reporting
        const { html: scanContent, lineMap } = isJsxFile(filePath)
            ? transformJsxToHtml(sourceContent)
            : { html: sourceContent, lineMap: null };

        const window = createJsdomWithAxe(scanContent);
        const axeResults = await executeAxeAnalysis(window, config);

        const axeViolations = processAxeViolations(
            filePath,
            axeResults.violations,
            sourceContent,
            lineMap,
            isJsxFile(filePath) ? scanContent : null
        );
        violations.push(...axeViolations);

        if (config.rules.rtl) {
            const htmlOpenTag = getHtmlOpenTag(window.document);
            const rtlViolation = checkIsraeliRtlCompliance(
                window.document,
                filePath,
                sourceContent,
                htmlOpenTag
            );
            if (rtlViolation) violations.push(rtlViolation);
        }

        window.close();

    } catch (error) {
        p.log.error(`Error scanning ${filePath}: ${error.message}`);
    }

    return violations;
}