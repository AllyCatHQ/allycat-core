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
import { glob } from 'glob';
import fs from 'fs/promises';
import { statSync } from 'fs';
import * as p from '@clack/prompts';
import path from 'path';
import { findLineNumber } from '../utils/sourceMapper.js';

/**
 * Main full audit entry point
 * @param {Object} config - User configuration
 * @param {string|null} targetPath - Optional specific file/folder to scan
 */
export async function runFullAudit(config, targetPath = null) {
    const files = await resolveFiles(config, targetPath);

    if (files.length === 0) {
        p.log.warn('No matching files found to scan.');
        return [];
    }

    p.log.info(`Found ${files.length} file${files.length > 1 ? 's' : ''} to scan.`);
    p.log.info('Using Playwright for full accessibility audit (including contrast)...');

    // Launch browser once for all files
    const browser = await chromium.launch({ headless: true });
    const allResults = [];

    try {
        for (const file of files) {
            const results = await scanFile(browser, file, config);
            allResults.push(...results);
        }
    } finally {
        await browser.close();
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
 * Scan a single file using Playwright
 */
async function scanFile(browser, file, config) {
    const results = [];

    try {
        const content = await fs.readFile(file, 'utf8');
        
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.setContent(content, { 
            waitUntil: 'domcontentloaded' 
        });

        const axeBuilder = new AxeBuilder({ page })
            .withTags(getAxeTags(config));

        const axeResults = await axeBuilder.analyze();

        // Process each violation - one result per element
        for (const violation of axeResults.violations) {
            for (const node of violation.nodes) {
                const htmlSnippet = node.html;
                const selector = node.target?.[0] || '';
                
                // Find line number by matching HTML snippet
                const lineNumber = findLineNumber(content, htmlSnippet);
                
                const result = {
                    file,
                    id: violation.id,
                    impact: violation.impact || 'minor',
                    description: violation.description,
                    help: violation.help,
                    helpUrl: violation.helpUrl,
                    wcagTags: violation.tags.filter(t => t.startsWith('wcag')),
                    // Location data
                    selector,
                    html: htmlSnippet,
                    lineNumber,
                    // Failure details
                    failureSummary: node.failureSummary,
                };

                // Add contrast data if applicable
                if (violation.id.includes('contrast')) {
                    result.contrastData = extractContrastData(node);
                }

                results.push(result);
            }
        }

        // Israeli RTL compliance check
        if (config.rules.rtl) {
            const hasRtl = await page.evaluate(() => {
                return document.documentElement.getAttribute('dir') === 'rtl';
            });

            if (!hasRtl) {
                const htmlSnippet = await page.evaluate(() => {
                    const html = document.documentElement;
                    return html.outerHTML.split('>')[0] + '>';
                });
                
                const lineNumber = findLineNumber(content, '<html');
                
                results.push({
                    file,
                    id: 'israel-rtl',
                    impact: 'serious',
                    description: 'Israeli law requires RTL direction for Hebrew interfaces.',
                    help: 'Add dir="rtl" to your <html> tag.',
                    helpUrl: 'https://www.gov.il/he/departments/policies/accessibility_standard',
                    wcagTags: ['israeli-standard'],
                    selector: 'html',
                    html: htmlSnippet,
                    lineNumber,
                });
            }
        }

        await context.close();

    } catch (err) {
        p.log.error(`Error scanning ${file}: ${err.message}`);
    }

    return results;
}

/**
 * Extract contrast-specific data from violation node
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