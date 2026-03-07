/**
 * Quick Scanner - JSDOM-based accessibility auditing
 *
 * Fast scanning using JSDOM + axe-core.
 * Does NOT check color contrast (requires real browser).
 *
 * Concurrency is controlled via config.performance.concurrency (default: 5).
 * Each file scan is isolated — failures are caught and logged without stopping others.
 *
 * Use for: Development, quick checks, CI fast-fail
 */

import { readSourceFile } from '../../utils/fileUtils.js';
import { readFileSync } from 'fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createRequire } from 'module';
import * as p from '@clack/prompts';
import pLimit from 'p-limit';
import { resolveFiles } from '../../utils/fileResolver.js';
import { MESSAGES } from '../../constants.js';
import { getAxeTags } from '../../utils/axeConfig.js';
import { checkRtlCompliance, checkJsxRtlCompliance } from '../../utils/rtlValidator.js';
import { processAxeViolations } from '../../utils/violationProcessor.js';
import { transformJsxToHtml, isJsxFile } from '../transformers/jsxTransformer.js';
import { detectCssInJs } from '../transformers/transformerUtils.js';
import { transformVueToHtml, isVueFile } from '../transformers/vueTransformer.js';
import { transformAngularToHtml, isAngularTemplate } from '../transformers/angularTransformer.js';
import { isAngularComponentTs, extractInlineTemplate } from '../transformers/angularTsExtractor.js';
import { buildHtmlOrdinalIndex } from '../../utils/sourceMapper.js';

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
export async function runQuickAudit(config, targetPath = null, files = null) {
    const filesToScan = files ?? await resolveFiles(config, targetPath);

    if (filesToScan.length === 0) {
        p.log.warn(MESSAGES.NO_FILES_FOUND);
        return { violations: [], warnings: [] };
    }

    p.log.info(`Found ${filesToScan.length} file${filesToScan.length > 1 ? 's' : ''} to scan.`);

    const concurrency = config?.performance?.concurrency ?? 5;
    const limit = pLimit(concurrency);

    const results = await Promise.all(
        filesToScan.map(filePath =>
            limit(async () => {
                try {
                    return await scanSingleFile(filePath, config);
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
        runOnly: { type: 'tag', values: getAxeTags(config) },
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
    return htmlElement ? htmlElement.outerHTML.split('>')[0] + '>' : '<html>';
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
    let warning = null;

    try {
        const sourceContent = await readSourceFile(filePath);

        const isJsx        = isJsxFile(filePath);
        const isVue        = !isJsx && isVueFile(filePath);
        const isAngularHtml = !isJsx && !isVue && isAngularTemplate(sourceContent, filePath);
        const isAngularTs  = !isJsx && !isVue && !isAngularHtml && isAngularComponentTs(sourceContent, filePath);
        const isComponent  = isJsx || isVue || isAngularHtml || isAngularTs;

        let scanContent, lineMap, ordinalIndex;
        if (isJsx) {
            const cssInJs = detectCssInJs(sourceContent);
            if (cssInJs) warning = `CSS-in-JS detected (${cssInJs}) - contrast checking unavailable even with --full`;
            ({ html: scanContent, lineMap, ordinalIndex } = transformJsxToHtml(sourceContent));
        } else if (isVue) {
            ({ html: scanContent, lineMap, ordinalIndex } = transformVueToHtml(sourceContent));
        } else if (isAngularHtml) {
            ({ html: scanContent, lineMap, ordinalIndex } = transformAngularToHtml(sourceContent));
        } else if (isAngularTs) {
            const extracted = extractInlineTemplate(sourceContent);
            if (!extracted) return [];  // templateUrl-only or unextractable — .html scanned separately
            ({ html: scanContent, lineMap, ordinalIndex } = transformAngularToHtml(extracted.content, extracted.lineOffset));
        } else {
            scanContent = sourceContent; lineMap = null; ordinalIndex = buildHtmlOrdinalIndex(sourceContent);
        }

        const window = createJsdomWithAxe(scanContent);
        const axeResults = await executeAxeAnalysis(window, config);

        const axeViolations = processAxeViolations(
            filePath,
            axeResults.violations,
            sourceContent,
            isComponent ? lineMap : null,
            isComponent ? scanContent : null,
            ordinalIndex,
            window.document
        );
        violations.push(...axeViolations);

        if (config.rules.rtl) {
            const rtlViolation = isComponent
                ? checkJsxRtlCompliance(window.document, filePath, sourceContent, ordinalIndex, config.selectedStandard)
                : checkRtlCompliance(window.document, filePath, sourceContent, getHtmlOpenTag(window.document), config.selectedStandard);
            if (rtlViolation) violations.push(rtlViolation);
        }

        window.close();

    } catch (error) {
        p.log.error(`Error scanning ${filePath}: ${error.message}`);
    }

    return { violations, warning };
}
