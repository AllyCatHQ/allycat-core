/**
 * Violation Processor
 *
 * Converts raw axe-core violation data into formatted result objects.
 * Resolves source line numbers using a 3-layer strategy for JSX/TSX files.
 *
 * @module engine/violations/violationProcessor
 */

import { findLineNumber, extractSourceTag } from '../../utils/sourceMapper.js';
import { HTML_WRAPPER_OFFSET } from '../transformers/transformerUtils.js';

// Rules that require a complete HTML document context.
// These are false positives when scanning JSX/TSX component fragments.
// Defined in constants.js (also used by baselineManager); re-exported here
// to keep the historical import path working.
import { DOCUMENT_LEVEL_RULES } from '../../constants.js';
export { DOCUMENT_LEVEL_RULES };

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

// -----------------------------------------------------------------------------
// JSX Line Resolution — 3-layer strategy
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
// Line Number Routing
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

    // HTML file with ordinal index: try Layer A (DOM ordinal position) first.
    // This correctly resolves identical elements like multiple <button></button>
    // that share the same HTML snippet and would otherwise all map to line 1.
    if (ordinalIndex && domDocument) {
        const layerA = resolveViaOrdinalIndex(cssSelector, domDocument, ordinalIndex);
        if (layerA !== null) return layerA;
    }

    // Fallback — text-based first-occurrence search
    return findLineNumber(sourceContent, htmlSnippet);
}

// -----------------------------------------------------------------------------
// Stable Selector
// -----------------------------------------------------------------------------

/**
 * Compute a stable canonical selector for a DOM element.
 *
 * axe-core generates the shortest unique selector per element — a single
 * <button> gets selector "button", but when two <button>s exist both get the
 * full positional path "body > button:nth-child(n)".  The selector format
 * therefore changes whenever a sibling is added, breaking composite-key
 * matching in the baseline even though the original element was never touched.
 *
 * This function walks the live DOM from the element up to <body> and builds
 * a full path using tag:nth-child(n) for every node — always the same format,
 * regardless of how many siblings exist.
 *
 * @param {string}        cssSelector - axe-core CSS selector (node.target[0])
 * @param {Document|null} domDocument - live DOM for querySelector
 * @returns {string|null} "body > tag:nth-child(n) > ..." or null if unavailable
 */
function computeStableSelector(cssSelector, domDocument) {
    if (!cssSelector || !domDocument) return null;

    try {
        const element = domDocument.querySelector(cssSelector);
        if (!element) return null;

        const parts = [];
        let current = element;

        while (current && current !== domDocument.body) {
            const parent = current.parentElement;
            if (!parent) break;

            const tag = current.tagName.toLowerCase();
            const position = Array.from(parent.children).indexOf(current) + 1;
            parts.unshift(`${tag}:nth-child(${position})`);
            current = parent;
        }

        return 'body > ' + parts.join(' > ');
    } catch {
        return null;
    }
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

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
    lineMap = null, transformedHtml = null, ordinalIndex = null, domDocument = null,
    isComponentContext = false
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

    const sourceSnippet = (isComponentContext && lineNumber)
        ? extractSourceTag(sourceContent, lineNumber)
        : undefined;

    return {
        file: filePath,
        id: violation.id,
        impact: violation.impact || 'minor',
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        wcagTags: violation.tags.filter(tag => tag.startsWith('wcag')),
        selector: cssSelector,
        stableSelector: computeStableSelector(cssSelector, domDocument),
        html: htmlSnippet,
        sourceSnippet,
        lineNumber,
        failureSummary: node.failureSummary,
    };
}

/**
 * Process all axe violations into formatted result objects.
 *
 * @param {string} filePath
 * @param {Array} violations - Raw axe violations array
 * @param {string} sourceContent
 * @param {Map<number,number>|null} lineMap
 * @param {string|null} transformedHtml
 * @param {Map<string,number[]>|null} ordinalIndex
 * @param {Document|null} domDocument
 * @returns {Array}
 */
export function processAxeViolations(
    filePath, violations, sourceContent,
    lineMap = null, transformedHtml = null, ordinalIndex = null, domDocument = null,
    nodeEnhancer = null
) {
    // A component context means we have a transformed HTML string (JSX/Vue/Angular).
    // Plain HTML files pass null for transformedHtml.
    const isComponentContext = transformedHtml !== null;
    const results = [];

    for (const violation of violations) {
        // Skip document-level rules for component files (JSX/TSX/Vue/Angular).
        // A component is a fragment, not a full page — these rules don't apply.
        if (isComponentContext && DOCUMENT_LEVEL_RULES.has(violation.id)) continue;

        for (const node of violation.nodes) {
            const base = createViolationFromNode(
                filePath, violation, node, sourceContent,
                lineMap, transformedHtml, ordinalIndex, domDocument,
                isComponentContext
            );
            results.push(nodeEnhancer ? nodeEnhancer(base, violation, node) : base);
        }
    }

    return results;
}
