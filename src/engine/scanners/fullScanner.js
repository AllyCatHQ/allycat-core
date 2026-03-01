/**
 * Full Scanner - Playwright-based accessibility auditing
 *
 * Complete scanning using real Chromium browser + axe-core.
 * Includes color contrast checking (requires browser layout engine).
 *
 * Use for: Pre-commit checks, CI/CD pipelines, thorough audits
 *
 * Requirements:
 *   npm install playwright @axe-core/playwright
 *   npx playwright install chromium
 *
 ** Concurrency is capped at 3 for full scan mode due to Playwright memory overhead.
 * Per-file failures are caught and logged — other files continue scanning.
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'fs/promises';
import * as p from '@clack/prompts';
import { resolveFiles } from '../../utils/fileResolver.js';
import { MESSAGES, STANDARDS } from '../../constants.js';
import { getAxeTags } from '../../utils/axeConfig.js';
import { createRtlViolation } from '../../utils/rtlValidator.js';
import { createViolationFromNode, DOCUMENT_LEVEL_RULES } from '../../utils/violationProcessor.js';
import { findLineNumber } from '../../utils/sourceMapper.js';
import { transformJsxToHtml, isJsxFile } from '../transformers/jsxTransformer.js';
import { transformVueToHtml, isVueFile } from '../transformers/vueTransformer.js';
import { resolvAndInjectCss } from '../../utils/cssResolver.js';
import path from 'path';
import pLimit from 'p-limit';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Main full audit entry point
 *
 * @param {Object} config - User configuration
 * @param {string|null} targetPath - Optional specific file/folder to scan
 * @returns {Promise<Array>} - Array of violation objects
 */
export async function runFullAudit(config, targetPath = null, files = null) {
    const filesToScan = files ?? await resolveFiles(config, targetPath);

    if (filesToScan.length === 0) {
        p.log.warn(MESSAGES.NO_FILES_FOUND);
        return [];
    }

    p.log.info(`Found ${filesToScan.length} file${filesToScan.length > 1 ? 's' : ''} to scan.`);
    p.log.info('Using Playwright for full accessibility audit (including contrast)...');

    const browser = await chromium.launch({ headless: true });

    // Shared CSS cache for this scan run — each CSS file read from disk exactly once
    const cssCache = new Map();

    const rawConcurrency = config?.performance?.concurrency ?? 5;
    const concurrency = Math.min(rawConcurrency, 3); // Hard cap: Playwright memory overhead
    const limit = pLimit(concurrency);

    try {
        const results = await Promise.all(
            filesToScan.map(filePath =>
                limit(async () => {
                    try {
                        return await scanSingleFile(browser, filePath, config, cssCache);
                    } catch (err) {
                        p.log.warn(`⚠ Skipped ${filePath}: ${err.message}`);
                        return [];
                    }
                })
            )
        );

        return results.flat();
    } finally {
        await browser.close();
    }
}

// -----------------------------------------------------------------------------
// Query Document (Playwright path)
// -----------------------------------------------------------------------------

/**
 * Build a minimal JSDOM document from the transformed HTML.
 *
 * Playwright runs axe in a Chromium subprocess — its DOM is not accessible
 * from Node.js. We parse the same transformedHtml in a lightweight JSDOM
 * (no scripts, no axe) purely to enable querySelectorAll for ordinal lookup.
 *
 * The resulting DOM structure is identical to what Playwright rendered,
 * so axe's CSS selectors resolve to the same elements and the same ordinal
 * positions. This means Layer A works exactly as in the quick scanner.
 *
 * Cost: one tiny JSDOM parse per JSX file (no script execution, no resources).
 *
 * @param {string} transformedHtml
 * @returns {Document}
 */
function buildQueryDocument(transformedHtml) {
    const virtualConsole = new VirtualConsole();
    virtualConsole.on('error', () => { });
    return new JSDOM(transformedHtml, { virtualConsole }).window.document;
}

// -----------------------------------------------------------------------------
// Contrast Data
// -----------------------------------------------------------------------------

function extractContrastData(node) {
    const data = node.any?.[0]?.data || {};
    return {
        contrastRatio: data.contrastRatio,
        expectedRatio: data.expectedContrastRatio,
        fgColor: data.fgColor,
        bgColor: data.bgColor,
        fontSize: data.fontSize,
        fontWeight: data.fontWeight,
    };
}

/**
 * Enhance violation with contrast data if applicable
 *
 * @param {Object} violation - Base violation object
 * @param {Object} axeViolation - Original axe violation
 * @param {Object} node - Axe node data
 * @returns {Object} - Enhanced violation object
 */
function enhanceWithContrastData(violation, axeViolation, node) {
    if (axeViolation.id.includes('contrast')) {
        return { ...violation, contrastData: extractContrastData(node) };
    }
    return violation;
}

// -----------------------------------------------------------------------------
// Violation Processing
// -----------------------------------------------------------------------------

/**
 * Process full-scan violations with ordinal-index resolution and contrast data.
 *
 * Builds the query document once per file — not once per violation.
 * That document is then shared across all violation nodes for that file.
 *
 * @param {string} filePath
 * @param {Array} violations
 * @param {string} sourceContent
 * @param {Map<number,number>|null} lineMap
 * @param {string|null} transformedHtml
 * @param {Map<string,number[]>|null} ordinalIndex
 * @returns {Array}
 */
function processFullScanViolations(
    filePath, violations, sourceContent,
    lineMap = null, transformedHtml = null, ordinalIndex = null
) {
    const isJsxContext = lineMap && transformedHtml;
    const domDocument = isJsxContext ? buildQueryDocument(transformedHtml) : null;
    const results = [];

    for (const violation of violations) {
        // Skip document-level rules for JSX/TSX component files.
        if (isJsxContext && DOCUMENT_LEVEL_RULES.has(violation.id)) continue;

        for (const node of violation.nodes) {
            const base = createViolationFromNode(
                filePath, violation, node, sourceContent,
                lineMap, transformedHtml, ordinalIndex, domDocument
            );
            results.push(enhanceWithContrastData(base, violation, node));
        }
    }

    return results;
}
// -----------------------------------------------------------------------------
// RTL Compliance (Playwright path)
// -----------------------------------------------------------------------------

/**
 * Check RTL compliance using Playwright page
 *
 * @param {Object} page - Playwright page object
 * @param {string} filePath - Source file path
 * @param {string} sourceContent - Original source code
 * @returns {Promise<Object|null>} - RTL violation object or null
 */

async function checkRtlCompliancePlaywright(page, filePath, sourceContent, isJsx, ordinalIndex, selectedStandard) {
    if (isJsx) {
        const hasRtl = await page.evaluate(() => !!document.querySelector('[dir="rtl"]'));
        if (hasRtl) return null;

        const rootInfo = await page.evaluate(() => {
            const root = document.body?.firstElementChild;
            return root
                ? { tag: root.tagName.toLowerCase(), html: root.outerHTML.split('>')[0] + '>' }
                : { tag: 'div', html: '<div>' };
        });

        const sourceLines = ordinalIndex?.get(rootInfo.tag);
        const lineNumber = (sourceLines && sourceLines.length > 0)
            ? sourceLines[0]
            : findLineNumber(sourceContent, `<${rootInfo.tag}`);

        const help = selectedStandard === STANDARDS.ISRAEL
            ? 'Add dir="rtl" to your root element or to the <html> tag in index.html.'
            : 'Add dir="rtl" to your root element to support RTL languages (Hebrew, Arabic, Persian).';

        return createRtlViolation(selectedStandard, filePath, rootInfo.html, lineNumber, rootInfo.tag, help);
    }

    // HTML file path
    const hasRtl = await page.evaluate(() => document.documentElement.getAttribute('dir') === 'rtl');
    if (hasRtl) return null;

    return createRtlViolation(
        selectedStandard,
        filePath,
        '<html>',
        findLineNumber(sourceContent, '<html')
    );
}

// -----------------------------------------------------------------------------
// File Scanning
// -----------------------------------------------------------------------------

/**
 * Scan a single file using Playwright
 *
 * @param {Object} browser - Playwright browser instance
 * @param {string} filePath - File path to scan
 * @param {Object} config - User configuration
 * @returns {Promise<Array>} - Array of violation objects
 */
async function scanSingleFile(browser, filePath, config, cssCache) {
    const violations = [];

    try {
        const sourceContent = await fs.readFile(filePath, 'utf8');

        const isJsx = isJsxFile(filePath);
        const isVue = !isJsx && isVueFile(filePath);
        const isComponent = isJsx || isVue;

        const { html: transformedHtml, lineMap, ordinalIndex } = isJsx
            ? transformJsxToHtml(sourceContent)
            : isVue
                ? transformVueToHtml(sourceContent)
                : { html: sourceContent, lineMap: null, ordinalIndex: null };

        // Inject imported CSS so Playwright can compute accurate contrast values
        const scanContent = await resolvAndInjectCss(
            transformedHtml,
            sourceContent,
            path.resolve(filePath),
            cssCache
        );

        const context = await browser.newContext();
        const page = await context.newPage();
        await page.setContent(scanContent, { waitUntil: 'domcontentloaded' });

        const axeResults = await new AxeBuilder({ page })
            .withTags(getAxeTags(config))
            .analyze();

        violations.push(...processFullScanViolations(
            filePath,
            axeResults.violations,
            sourceContent,
            isComponent ? lineMap : null,
            isComponent ? scanContent : null,
            isComponent ? ordinalIndex : null
        ));

        if (config.rules.rtl) {
            const rtlViolation = await checkRtlCompliancePlaywright(page, filePath, sourceContent, isComponent, isComponent ? ordinalIndex : null, config.selectedStandard);
            if (rtlViolation) violations.push(rtlViolation);
        }

        await context.close();

    } catch (error) {
        p.log.error(`Error scanning ${filePath}: ${error.message}`);
    }

    return violations;
}
