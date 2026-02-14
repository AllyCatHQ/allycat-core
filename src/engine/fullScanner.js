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
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { glob } from 'glob';
import fs from 'fs/promises';
import { statSync } from 'fs';
import * as p from '@clack/prompts';
import path from 'path';

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
        // Read file content
        const content = await fs.readFile(file, 'utf8');
        
        // Create context and page (required by axe-core/playwright)
        const context = await browser.newContext();
        const page = await context.newPage();

        // Load HTML content directly
        await page.setContent(content, { 
            waitUntil: 'domcontentloaded' 
        });

        // Run axe-core with full capabilities
        const axeBuilder = new AxeBuilder({ page })
            .withTags(getAxeTags(config));

        const axeResults = await axeBuilder.analyze();

        // Collect violations - ONE per rule (not per element)
        axeResults.violations.forEach(v => {
            const result = {
                file,
                id: v.id,
                impact: v.impact || 'minor',
                description: v.description,
                help: v.help,
                wcagTags: v.tags.filter(t => t.startsWith('wcag')),
                nodeCount: v.nodes.length,  // How many elements affected
            };

            // Add contrast data if this is a contrast violation
            if (v.id.includes('contrast') && v.nodes.length > 0) {
                const firstNode = v.nodes[0];
                result.contrastData = extractContrastData(v, firstNode);
            }

            results.push(result);
        });

        // Israeli RTL compliance check
        if (config.rules.rtl) {
            const hasRtl = await page.evaluate(() => {
                return document.documentElement.getAttribute('dir') === 'rtl';
            });

            if (!hasRtl) {
                results.push({
                    file,
                    id: 'israel-rtl',
                    impact: 'serious',
                    description: 'Israeli law requires RTL direction for Hebrew interfaces.',
                    help: 'Add dir="rtl" to your <html> tag.',
                    wcagTags: ['israeli-standard'],
                    nodeCount: 1,
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
 * Extract contrast-specific data from violation
 */
function extractContrastData(violation, node) {
    if (!violation.id.includes('contrast')) return null;

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