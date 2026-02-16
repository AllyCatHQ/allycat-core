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
 * Scan a single file for accessibility issues
 */
async function scanFile(file, config) {
    const results = [];

    try {
        const content = await fs.readFile(file, 'utf8');

        // Create virtual browser environment
        const dom = new JSDOM(content, {
            runScripts: 'dangerously',
            resources: 'usable',
            pretendToBeVisual: true,
            virtualConsole: createQuietConsole()
        });

        const { window } = dom;

        // Inject axe-core into virtual browser
        window.eval(axeSource);

        // Run axe with contrast rules DISABLED (they don't work in JSDOM)
        const axeResults = await window.axe.run(window.document, {
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

        // Process each violation
        for (const violation of axeResults.violations) {
            // Create one result per affected element (not per rule)
            // This gives developers precise locations
            for (const node of violation.nodes) {
                const htmlSnippet = node.html;
                const selector = node.target?.[0] || '';
                
                // Find line number by matching HTML snippet in source
                const lineNumber = findLineNumber(content, htmlSnippet);
                
                results.push({
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
                });
            }
        }

        // Israeli RTL compliance check
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

/**
 * Create a quiet virtual console (suppresses JSDOM warnings)
 */
function createQuietConsole() {
    const vc = new VirtualConsole();
    vc.on('error', () => {});
    vc.on('warn', () => {});
    return vc;
}

/**
 * Check RTL compliance for Israeli standard
 */
function checkRtlCompliance(document, file, sourceContent) {
    const htmlTag = document.documentElement;
    const hasRtlDir = htmlTag && htmlTag.getAttribute('dir') === 'rtl';

    if (!hasRtlDir) {
        // Find line number of <html> tag
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