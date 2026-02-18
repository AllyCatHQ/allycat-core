/**
 * Full Scanner - Playwright-based accessibility auditing
 * 
 * Complete scanning using real Chromium browser + axe-core.
 * Includes color contrast checking (requires browser layout engine).
 * 
 * Enhanced with:
 * - Element selectors
 * - HTML snippets
 * - Approximate line numbers
 * 
 * Use for: Pre-commit checks, CI/CD pipelines, thorough audits
 * 
 * Requirements:
 *   npm install playwright @axe-core/playwright
 *   npx playwright install chromium
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs/promises';
import * as p from '@clack/prompts';
import {
    resolveFiles,
    getAxeTags,
    createRtlViolation,
    createViolationFromNode
} from '../utils/scannerUtils.js';
import { findLineNumber } from '../utils/sourceMapper.js';
import { transformJsxToHtml, isJsxFile } from './transformers/jsxTransformer.js';

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
export async function runFullAudit(config, targetPath = null) {
    const filesToScan = await resolveFiles(config, targetPath);

    if (filesToScan.length === 0) {
        p.log.warn('No matching files found to scan.');
        return [];
    }

    p.log.info(`Found ${filesToScan.length} file${filesToScan.length > 1 ? 's' : ''} to scan.`);
    p.log.info('Using Playwright for full accessibility audit (including contrast)...');

    const browser = await chromium.launch({ headless: true });
    const allViolations = [];

    try {
        for (const filePath of filesToScan) {
            const fileViolations = await scanSingleFile(browser, filePath, config);
            allViolations.push(...fileViolations);
        }
    } finally {
        await browser.close();
    }

    return allViolations;
}

// -----------------------------------------------------------------------------
// Contrast Data Extraction
// -----------------------------------------------------------------------------

/**
 * Extract contrast-specific data from violation node
 * 
 * @param {Object} node - Axe violation node
 * @returns {Object} - Contrast data object
 */
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
        return {
            ...violation,
            contrastData: extractContrastData(node)
        };
    }
    return violation;
}

// -----------------------------------------------------------------------------
// Violation Processing
// -----------------------------------------------------------------------------

/**
 * Process axe violations with contrast data support
 * 
 * Uses shared createViolationFromNode() and enhances with contrast data.
 * 
 * @param {string} filePath - Source file path
 * @param {Array} violations - Array of axe violation objects
 * @param {string} sourceContent - Original source code
 * @returns {Array} - Array of formatted violation results
 */
function processFullScanViolations(filePath, violations, sourceContent, lineMap = null, transformedHtml = null) {
    const results = [];
    for (const violation of violations) {
        for (const node of violation.nodes) {
            const baseViolation = createViolationFromNode(
                filePath, violation, node, sourceContent, lineMap, transformedHtml
            );
            const enhancedViolation = enhanceWithContrastData(baseViolation, violation, node);
            results.push(enhancedViolation);
        }
    }
    return results;
}

// -----------------------------------------------------------------------------
// Israeli RTL Compliance (Playwright-specific)
// -----------------------------------------------------------------------------

/**
 * Check RTL compliance using Playwright page
 * 
 * @param {Object} page - Playwright page object
 * @param {string} filePath - Source file path
 * @param {string} sourceContent - Original source code
 * @returns {Promise<Object|null>} - RTL violation object or null
 */
async function checkRtlCompliancePlaywright(page, filePath, sourceContent) {
    const hasRtl = await page.evaluate(() => {
        return document.documentElement.getAttribute('dir') === 'rtl';
    });

    if (hasRtl) {
        return null;
    }

    const htmlOpenTag = await page.evaluate(() => {
        const html = document.documentElement;
        return html.outerHTML.split('>')[0] + '>';
    });

    const lineNumber = findLineNumber(sourceContent, '<html');

    return createRtlViolation(filePath, htmlOpenTag, lineNumber);
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
async function scanSingleFile(browser, filePath, config) {
    const violations = [];

    try {
        const sourceContent = await fs.readFile(filePath, 'utf8');

        const { html: scanContent, lineMap } = isJsxFile(filePath)
            ? transformJsxToHtml(sourceContent)
            : { html: sourceContent, lineMap: null };

        const context = await browser.newContext();
        const page = await context.newPage();

        await page.setContent(scanContent, { waitUntil: 'domcontentloaded' });

        const axeBuilder = new AxeBuilder({ page }).withTags(getAxeTags(config));
        const axeResults = await axeBuilder.analyze();

        const axeViolations = processFullScanViolations(
            filePath,
            axeResults.violations,
            sourceContent,
            lineMap,
            isJsxFile(filePath) ? scanContent : null
        );
        violations.push(...axeViolations);

        if (config.rules.rtl) {
            const rtlViolation = await checkRtlCompliancePlaywright(page, filePath, sourceContent);
            if (rtlViolation) violations.push(rtlViolation);
        }

        await context.close();

    } catch (error) {
        p.log.error(`Error scanning ${filePath}: ${error.message}`);
    }

    return violations;
}