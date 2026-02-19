/**
 * Scanner Utilities
 *
 * Shared utilities for both quick and full scanners.
 * Contains file resolution, axe-core configuration, and compliance checks.
 *
 * @module utils/scannerUtils
 */

import { glob } from 'glob';
import { statSync } from 'fs';
import path from 'path';
import * as p from '@clack/prompts';
import { findLineNumber } from './sourceMapper.js';
import { normalizeForGlob } from './pathUtils.js';
import { HTML_WRAPPER_OFFSET } from '../engine/transformers/jsxTransformer.js';

// -----------------------------------------------------------------------------
// File Resolution
// -----------------------------------------------------------------------------

export async function resolveFiles(config, targetPath) {
    const extensions = getFrameworkExtensions(config.framework);

    if (targetPath) {
        return await resolveTargetPath(targetPath, extensions);
    }

    const patterns = extensions.map(ext => `**/*.${ext}`);
    const files = await glob(patterns, {
        ignore: ['**/node_modules/**', '**/dist/**', '**/build/**'],
        dot: false
    });

    return files;
}

export function getFrameworkExtensions(framework) {
    const extensionMap = {
        'react': ['jsx', 'tsx', 'html'],
        'vue': ['vue', 'html'],
        'angular': ['html', 'component.html'],
        'html': ['html']
    };
    return extensionMap[framework] || extensionMap['html'];
}

export async function resolveTargetPath(targetPath, extensions) {
    const stats = statSync(targetPath);

    if (stats.isFile()) {
        const fileExtension = path.extname(targetPath).slice(1);
        if (!extensions.includes(fileExtension)) {
            p.log.warn(`File extension .${fileExtension} not in expected list: ${extensions.join(', ')}`);
        }
        return [targetPath];
    }

    if (stats.isDirectory()) {
        const normalizedPath = normalizeForGlob(targetPath);
        const globPattern = `${normalizedPath}/**/*.{${extensions.join(',')}}`;
        return await glob(globPattern, {
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
        });
    }

    return [];
}

// -----------------------------------------------------------------------------
// Axe-Core Configuration
// -----------------------------------------------------------------------------

export function getAxeTags(config) {
    const baseTags = ['best-practice'];
    const standardTagMap = {
        'israel': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        'wcag-aaa': ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
        'wcag-aa': ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
    };
    return [...baseTags, ...(standardTagMap[config.selectedStandard] || standardTagMap['wcag-aa'])];
}

// -----------------------------------------------------------------------------
// Israeli Standard Compliance
// -----------------------------------------------------------------------------

export function createRtlViolation(filePath, htmlOpenTag, lineNumber) {
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

export function checkIsraeliRtlCompliance(document, filePath, sourceContent, htmlOpenTag) {
    const htmlElement = document.documentElement;
    const hasRtlDirection = htmlElement && htmlElement.getAttribute('dir') === 'rtl';
    if (hasRtlDirection) return null;
    return createRtlViolation(filePath, htmlOpenTag, findLineNumber(sourceContent, '<html'));
}

// -----------------------------------------------------------------------------
// Israeli Standard Compliance — JSX/TSX Strategy
// -----------------------------------------------------------------------------

/**
 * Check RTL compliance for JSX/TSX files.
 * Uses ordinalIndex to resolve the root element's source line accurately —
 * avoiding false matches inside comments or strings via plain text search.
 *
 * @param {Document} document - JSDOM document from transformed JSX
 * @param {string} filePath
 * @param {string} sourceContent - Original JSX source
 * @param {Map<string, number[]>|null} ordinalIndex - tag → [sourceLine, ...] in document order
 * @returns {Object|null}
 */
export function checkJsxRtlCompliance(document, filePath, sourceContent, ordinalIndex) {
    const anyRtlElement = document.querySelector('[dir="rtl"]');
    if (anyRtlElement) return null;

    const rootElement = document.body?.firstElementChild;
    const rootTag = rootElement ? rootElement.tagName.toLowerCase() : 'div';
    const rootHtml = rootElement
        ? rootElement.outerHTML.split('>')[0] + '>'
        : '<div>';

    // Use ordinalIndex (AST-derived) for accurate line resolution.
    // Falls back to text search only if ordinalIndex is unavailable.
    const sourceLines = ordinalIndex?.get(rootTag);
    const lineNumber = (sourceLines && sourceLines.length > 0)
        ? sourceLines[0]
        : findLineNumber(sourceContent, `<${rootTag}`);

    return {
        file: filePath,
        id: 'israel-rtl',
        impact: 'serious',
        description: 'Israeli law requires RTL direction for Hebrew interfaces.',
        help: `Add dir="rtl" to your root element or to the <html> tag in index.html.`,
        helpUrl: 'https://www.gov.il/he/departments/policies/accessibility_standard',
        wcagTags: ['israeli-standard'],
        selector: rootTag,
        html: rootHtml,
        lineNumber,
    };
}

// -----------------------------------------------------------------------------
// JSX Line Resolution
// -----------------------------------------------------------------------------
/**
 * Resolve JSX source line using the 3-layer strategy.
 *
 * @param {string} cssSelector     - axe node.target[0]
 * @param {string} htmlSnippet     - axe node.html
 * @param {string} sourceContent   - original JSX source
 * @param {Map<number,number>} lineMap       - htmlLine → jsxSourceLine
 * @param {string} transformedHtml           - full HTML from transformer
 * @param {Map<string,number[]>} ordinalIndex - tag → [sourceLine, ...] in document order
 * @param {Document|null} domDocument        - live JSDOM document (or null)
 * @returns {number|null}
 */
function resolveJsxLineNumber(
    cssSelector, htmlSnippet, sourceContent,
    lineMap, transformedHtml, ordinalIndex, domDocument
) {
    // Layer A — ordinal index via DOM position
    const layerA = resolveViaOrdinalIndex(cssSelector, domDocument, ordinalIndex);
    if (layerA !== null) return layerA;

    // Layer B — unique attribute search in transformed HTML
    const layerB = resolveViaUniqueAttribute(htmlSnippet, lineMap, transformedHtml);
    if (layerB !== null) return layerB;

    // Layer C — sourceMapper on original JSX source
    return findLineNumber(sourceContent, htmlSnippet);
}

// -----------------------------------------------------------------------------
// Layer A — Ordinal Index via DOM Position
// -----------------------------------------------------------------------------

/**
 * Find the violation's ordinal position among same-tag elements using the
 * live DOM, then look up that position in the ordinalIndex.
 *
 * @param {string} cssSelector
 * @param {Document|null} domDocument
 * @param {Map<string,number[]>} ordinalIndex
 * @returns {number|null}
 */
function resolveViaOrdinalIndex(cssSelector, domDocument, ordinalIndex) {
    if (!cssSelector || !domDocument || !ordinalIndex) return null;

    try {
        const element = domDocument.querySelector(cssSelector);
        if (!element) return null;

        const tag = element.tagName.toLowerCase();
        const sourceLines = ordinalIndex.get(tag);
        if (!sourceLines || sourceLines.length === 0) return null;

        // Find this element's ordinal position among all same-tag elements
        const allSameTag = Array.from(domDocument.querySelectorAll(tag));
        const elementIndex = allSameTag.indexOf(element);
        if (elementIndex === -1 || elementIndex >= sourceLines.length) return null;

        return sourceLines[elementIndex];
    } catch {
        // querySelector can throw on malformed selectors
        return null;
    }
}

// -----------------------------------------------------------------------------
// Layer B — Unique Attribute Search in transformedHtml
// -----------------------------------------------------------------------------

/**
 * Search the axe HTML snippet for a unique attribute value and find it
 * in the transformed HTML lines to get a lineMap entry.
 *
 * This layer activates when domDocument is unavailable (Playwright path)
 * but the element has a unique attribute that makes it findable by text.
 *
 * Excluded value 'dynamic' — this is the transformer's placeholder for
 * runtime-computed expressions. It appears on many elements and would
 * cause false matches.
 *
 * @param {string} htmlSnippet
 * @param {Map<number,number>} lineMap
 * @param {string} transformedHtml
 * @returns {number|null}
 */
function resolveViaUniqueAttribute(htmlSnippet, lineMap, transformedHtml) {
    if (!htmlSnippet || !lineMap || !transformedHtml) return null;

    const token = extractUniqueAttributeToken(htmlSnippet.trim());
    if (!token) return null;

    const htmlLines = transformedHtml.split('\n');

    for (const [htmlLineNumber, sourceLine] of lineMap.entries()) {
        const lineIndex = htmlLineNumber + HTML_WRAPPER_OFFSET - 1;
        const htmlLine = htmlLines[lineIndex];
        if (htmlLine && htmlLine.includes(token)) {
            return sourceLine;
        }
    }

    return null;
}

/**
 * Extract a unique attribute value from an HTML snippet for text-based search.
 *
 * Priority order (most → least unique):
 *   src    — almost always file-unique (image paths, script sources)
 *   href   — almost always file-unique (link targets)
 *   id     — semantically required to be document-unique
 *   name   — unique within a form context
 *   for    — ties to a specific id
 *   action — unique per form
 *   role   — often repeated; useful only when above are absent
 *
 * @param {string} html - HTML snippet from axe
 * @returns {string|null}
 */
function extractUniqueAttributeToken(html) {
    const priority = ['src', 'href', 'id', 'name', 'for', 'action', 'role'];

    for (const attr of priority) {
        const match = html.match(new RegExp(`${attr}="([^"]+)"`));
        if (match && match[1] && match[1] !== 'dynamic') {
            return match[1];
        }
    }

    return null;
}

// -----------------------------------------------------------------------------
// Violation Processing — Public API
// -----------------------------------------------------------------------------

/**
 * Route to the correct resolution strategy based on available context.
 *
 * @param {string} cssSelector
 * @param {string} htmlSnippet
 * @param {string} sourceContent
 * @param {Map<number,number>|null} lineMap
 * @param {string|null} transformedHtml
 * @param {Map<string,number[]>|null} ordinalIndex
 * @param {Document|null} domDocument
 * @returns {number|null}
 */
function resolveLineNumber(
    cssSelector, htmlSnippet, sourceContent,
    lineMap, transformedHtml, ordinalIndex, domDocument
) {
    const isJsxContext = lineMap && lineMap.size > 0 && transformedHtml && ordinalIndex;

    if (isJsxContext) {
        return resolveJsxLineNumber(
            cssSelector, htmlSnippet, sourceContent,
            lineMap, transformedHtml, ordinalIndex, domDocument
        );
    }

    // HTML file — use existing sourceMapper directly
    return findLineNumber(sourceContent, htmlSnippet);
}

/**
 * Create a single violation result object from axe node data.
 *
 * @param {string} filePath
 * @param {Object} violation - axe violation object
 * @param {Object} node - axe violation node
 * @param {string} sourceContent
 * @param {Map<number,number>|null} lineMap
 * @param {string|null} transformedHtml
 * @param {Map<string,number[]>|null} ordinalIndex
 * @param {Document|null} domDocument
 * @returns {Object}
 */
export function createViolationFromNode(
    filePath, violation, node, sourceContent,
    lineMap = null, transformedHtml = null, ordinalIndex = null, domDocument = null
) {
    const htmlSnippet = node.html;

    // axe node.target is always an array.
    // We use [0] — the outermost selector — for DOM lookup.
    // For iframes/shadow DOM it's the outer frame/host selector,
    // which querySelector CAN resolve from the outer document.
    const cssSelector = Array.isArray(node.target)
        ? (node.target[0] || '')
        : (node.target || '');

    const lineNumber = resolveLineNumber(
        cssSelector, htmlSnippet, sourceContent,
        lineMap, transformedHtml, ordinalIndex, domDocument
    );

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
 * Process all axe violations into formatted result objects.
 *
 * @param {string} filePath
 * @param {Array} violations
 * @param {string} sourceContent
 * @param {Map<number,number>|null} lineMap
 * @param {string|null} transformedHtml
 * @param {Map<string,number[]>|null} ordinalIndex
 * @param {Document|null} domDocument
 * @returns {Array}
 */
export function processAxeViolations(
    filePath, violations, sourceContent,
    lineMap = null, transformedHtml = null, ordinalIndex = null, domDocument = null
) {
    const results = [];

    for (const violation of violations) {
        for (const node of violation.nodes) {
            results.push(createViolationFromNode(
                filePath, violation, node, sourceContent,
                lineMap, transformedHtml, ordinalIndex, domDocument
            ));
        }
    }

    return results;
}