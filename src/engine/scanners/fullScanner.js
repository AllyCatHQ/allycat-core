/**
 * Full Scanner - Playwright-based accessibility auditing
 *
 * Complete scanning using real Chromium browser + axe-core.
 * Includes color contrast checking (requires browser layout engine).
 *
 * Use for: Pre-commit checks, CI/CD pipelines, thorough audits
 *
 * Requirements:
 *   Playwright is installed automatically with this package.
 *   Download the Chromium browser once before using --full:
 *   npx playwright install chromium
 *
 * Concurrency is RAM- and CPU-aware (via configLoader.getSafeConcurrencyCeiling).
 * Full mode is additionally capped at 8 due to Playwright CPU/IO overhead.
 * Per-file failures are caught and logged — other files continue scanning.
 */

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { JSDOM, VirtualConsole } from 'jsdom';
import { readSourceFile } from '../../utils/fileUtils.js';
import { getSafeConcurrencyCeiling } from '../../utils/configLoader.js';
import * as p from '@clack/prompts';
import { resolveFiles } from '../../utils/fileResolver.js';
import { MESSAGES, SCAN_MODES } from '../../constants.js';
import { getAxeTags } from '../../utils/axeConfig.js';
import { createViolationFromNode, DOCUMENT_LEVEL_RULES } from '../../utils/violationProcessor.js';
import { transformJsxToHtml } from '../transformers/jsxTransformer.js';
import { detectCssInJs } from '../transformers/transformerUtils.js';
import { transformVueToHtml } from '../transformers/vueTransformer.js';
import { transformAngularToHtml } from '../transformers/angularTransformer.js';
import { extractInlineTemplate, extractCssModuleImports } from '../transformers/angularTsExtractor.js';
import { detectFileContext } from './scannerUtils.js';
import { resolvAndInjectCss, loadTsconfigAliases } from '../../utils/cssResolver.js';
import { buildExtraCss } from './cssInjector.js';
import { checkRtlCompliancePlaywright } from './rtlRunner.js';
import path from 'path';
import pLimit from 'p-limit';
import chalk from 'chalk';

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
export async function runFullAudit(config, targetPath = null, files = null, silent = false) {
    const filesToScan = files ?? await resolveFiles(config, targetPath);

    if (filesToScan.length === 0) {
        if (!silent) p.log.warn(MESSAGES.NO_FILES_FOUND);
        return { violations: [], warnings: [] };
    }

    if (!silent) p.log.info(`Found ${filesToScan.length} file${filesToScan.length > 1 ? 's' : ''} to scan.`);
    if (!silent) p.log.info('Using Playwright for full accessibility audit (including contrast)...');

    let browser;
    try {
        browser = await chromium.launch({ headless: true });
    } catch (err) {
        if (err.message.includes('Executable doesn') || err.message.includes('browserType.launch')) {
            p.log.error(
                'Chromium browser not found.\n' +
                '  Run this once to download it:\n\n' +
                `  ${chalk.bold.cyan('npx playwright install chromium')}\n`
            );
            process.exit(1);
        }
        throw err;
    }

    // Shared CSS cache for this scan run — each CSS file read from disk exactly once
    const cssCache = new Map();

    // Custom path aliases from tsconfig.json (e.g. @components/ → src/components/)
    // Loaded once per scan run; empty Map if tsconfig.json is absent or has no paths
    const aliases = await loadTsconfigAliases(process.cwd());

    const concurrency = config?.performance?.concurrency ?? getSafeConcurrencyCeiling(SCAN_MODES.FULL);
    const limiter = pLimit(concurrency);

    try {
        const results = await Promise.all(
            filesToScan.map(filePath =>
                limiter(async () => {
                    try {
                        return await scanSingleFile(browser, filePath, config, cssCache, aliases);
                    } catch (err) {
                        p.log.warn(`⚠ Skipped ${filePath}: ${err.message}`);
                        return { violations: [], warning: null };
                    }
                })
            )
        );

        const warnings = [...new Set(results.map(r => r.warning).filter(Boolean))];
        warnings.forEach(w => p.log.warn(w));
        return { violations: results.flatMap(r => r.violations), warnings };
    } finally {
        await browser.close();
    }
}

// -----------------------------------------------------------------------------
// Violation Processing
//
// buildQueryDocument, extractContrastData, and enhanceWithContrastData are
// private helpers used exclusively by processFullScanViolations.
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

/**
 * Extract contrast ratio and color data from an axe node.
 *
 * @param {Object} node - Axe node data
 * @returns {{ contrastRatio, expectedRatio, fgColor, bgColor, fontSize, fontWeight }}
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
 * @param {Object} baseViolation - Base violation object
 * @param {Object} axeViolation - Original axe violation
 * @param {Object} node - Axe node data
 * @returns {Object} - Enhanced violation object
 */
function enhanceWithContrastData(baseViolation, axeViolation, node) {
    if (axeViolation.id.includes('contrast')) {
        return { ...baseViolation, contrastData: extractContrastData(node) };
    }
    return baseViolation;
}

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
    const isComponentContext = lineMap && transformedHtml;
    const domDocument = isComponentContext ? buildQueryDocument(transformedHtml) : null;
    const processed = [];

    for (const violation of violations) {
        // Skip document-level rules for component files (JSX/TSX/Vue/Angular).
        if (isComponentContext && DOCUMENT_LEVEL_RULES.has(violation.id)) continue;

        for (const node of violation.nodes) {
            const baseViolation = createViolationFromNode(
                filePath, violation, node, sourceContent,
                lineMap, transformedHtml, ordinalIndex, domDocument
            );
            processed.push(enhanceWithContrastData(baseViolation, violation, node));
        }
    }

    return processed;
}

// -----------------------------------------------------------------------------
// File Transformation
// -----------------------------------------------------------------------------

/**
 * Transform a source file to HTML ready for axe scanning.
 *
 * Dispatches to the appropriate transformer based on file type flags from
 * detectFileContext(). Returns null for Angular TS files that have no inline
 * template (templateUrl-only) — those are scanned via their companion .html.
 *
 * @param {string} filePath
 * @param {string} sourceContent
 * @param {{ isJsx: boolean, isVue: boolean, isAngularHtml: boolean, isAngularTs: boolean }} fileContext
 * @returns {Promise<{ transformedHtml: string, lineMap: Map|null, ordinalIndex: Map|null, cssModuleBindings: Map, warning: string|null }|null>}
 */
async function transformSourceFile(filePath, sourceContent, { isJsx, isVue, isAngularHtml, isAngularTs }) {
    let transformedHtml, lineMap, ordinalIndex;
    let cssModuleBindings = new Map();
    let warning = null;

    if (isJsx) {
        const cssInJs = detectCssInJs(sourceContent);
        if (cssInJs) warning = `CSS-in-JS detected (${cssInJs}) - contrast checking unavailable`;
        ({ html: transformedHtml, lineMap, ordinalIndex } = transformJsxToHtml(sourceContent));
    } else if (isVue) {
        ({ html: transformedHtml, lineMap, ordinalIndex } = transformVueToHtml(sourceContent));
    } else if (isAngularHtml) {
        // Look up the companion .component.ts for CSS module bindings.
        // Angular naming convention guarantees same directory; try/catch is safe.
        try {
            const companionTs = filePath.replace(/\.html$/, '.ts');
            const tsSource = await readSourceFile(companionTs);
            cssModuleBindings = extractCssModuleImports(tsSource);
        } catch { /* no companion .ts — fine */ }
        ({ html: transformedHtml, lineMap, ordinalIndex } = transformAngularToHtml(sourceContent, 0, cssModuleBindings));
    } else if (isAngularTs) {
        const extracted = extractInlineTemplate(sourceContent);
        if (!extracted) return null;  // templateUrl-only or unextractable — .html scanned separately
        cssModuleBindings = extractCssModuleImports(sourceContent);
        ({ html: transformedHtml, lineMap, ordinalIndex } = transformAngularToHtml(extracted.content, extracted.lineOffset, cssModuleBindings));
    } else {
        transformedHtml = sourceContent; lineMap = null; ordinalIndex = null;
    }

    return { transformedHtml, lineMap, ordinalIndex, cssModuleBindings, warning };
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
 * @param {Map<string,string>} cssCache - Shared CSS file cache for this scan run
 * @param {Map<string,string>} aliases - Resolved tsconfig path aliases
 * @returns {Promise<{ violations: Array, warning: string|null }>}
 */
async function scanSingleFile(browser, filePath, config, cssCache, aliases) {
    const violations = [];
    let warning = null;

    try {
        const sourceContent = await readSourceFile(filePath);

        const { isJsx, isVue, isAngularHtml, isAngularTs, isComponent } = detectFileContext(filePath, sourceContent);

        const transformResult = await transformSourceFile(filePath, sourceContent, { isJsx, isVue, isAngularHtml, isAngularTs });
        if (!transformResult) return { violations: [], warning: null };  // templateUrl-only Angular TS — .html scanned separately
        const { transformedHtml, lineMap, ordinalIndex, cssModuleBindings } = transformResult;
        warning = transformResult.warning;

        const extraCss = await buildExtraCss(filePath, sourceContent, { isVue, isAngularTs, isAngularHtml }, cssModuleBindings, cssCache, aliases);

        // Inject imported CSS so Playwright can compute accurate contrast values
        const scanContent = await resolvAndInjectCss(
            transformedHtml,
            sourceContent,
            path.resolve(filePath),
            cssCache,
            extraCss,
            aliases
        );

        const browserContext = await browser.newContext();
        const page = await browserContext.newPage();
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

        await browserContext.close();

    } catch (error) {
        p.log.error(`Error scanning ${filePath}: ${error.message}`);
    }

    return { violations, warning };
}
