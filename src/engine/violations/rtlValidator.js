/**
 * RTL Validator
 *
 * Checks RTL (right-to-left) compliance for HTML and JSX/TSX files.
 * Creates violation objects for missing dir="rtl" attributes.
 *
 * Detects missing RTL direction declarations for right-to-left language content.
 *
 * @module engine/violations/rtlValidator
 */

import { findLineNumber } from '../../utils/sourceMapper.js';

// -----------------------------------------------------------------------------
// RTL Language Detection
// -----------------------------------------------------------------------------

/** ISO 639-1/3 language codes whose primary script is right-to-left. */
export const RTL_LANG_PREFIXES = ['he', 'ar', 'fa', 'ur', 'yi', 'dv', 'ps', 'sd', 'ug'];

/**
 * Returns true when a lang attribute value indicates an RTL language.
 * Handles region subtags (e.g. "he-IL", "ar-SA") by comparing only the base tag.
 *
 * @param {string|null|undefined} lang
 * @returns {boolean}
 */
export function isRtlLanguage(lang) {
    if (!lang) return false;
    const base = lang.toLowerCase().split('-')[0];
    return RTL_LANG_PREFIXES.includes(base);
}

// -----------------------------------------------------------------------------
// RTL Violation Factories
// -----------------------------------------------------------------------------

/**
 * Create an RTL violation for missing dir="rtl" on RTL-language content.
 */
function createGenericRtlViolation(filePath, htmlOpenTag, lineNumber, selector = 'html', help = 'Add dir="rtl" to the root element or <html> tag to support RTL languages (Hebrew, Arabic, Persian).') {
    return {
        file: filePath,
        id: 'rtl-direction',
        impact: 'serious',
        description: 'RTL language content detected without a dir="rtl" attribute.',
        help,
        helpUrl: 'https://www.w3.org/International/questions/qa-html-dir',
        wcagTags: ['wcag131', 'best-practice'],
        selector,
        html: htmlOpenTag,
        lineNumber,
    };
}

export function createRtlViolation(filePath, htmlOpenTag, lineNumber, selector = 'html', help = undefined) {
    return createGenericRtlViolation(filePath, htmlOpenTag, lineNumber, selector,
        help ?? 'Add dir="rtl" to the root element to support RTL languages (Hebrew, Arabic, Persian).');
}

// -----------------------------------------------------------------------------
// HTML RTL Check
// -----------------------------------------------------------------------------

export function checkRtlCompliance(document, filePath, sourceContent, htmlOpenTag) {
    // Step 1: dir="rtl" declared anywhere (scoped or global) → compliant
    if (document.querySelector('[dir="rtl"]')) return null;

    // Step 2: Page language is not RTL → no obligation to declare RTL direction
    const htmlLang = document.documentElement?.getAttribute('lang');
    if (!isRtlLanguage(htmlLang)) return null;

    // Step 3: RTL-primary page with no dir declarations → genuine violation
    return createRtlViolation(filePath, htmlOpenTag, findLineNumber(sourceContent, '<html'));
}

// -----------------------------------------------------------------------------
// JSX/TSX RTL Check
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
    // Step 1: dir="rtl" declared anywhere → compliant
    if (document.querySelector('[dir="rtl"]')) return null;

    // Step 2: No element carries an RTL lang attribute → no RTL obligation in this component
    const rtlLangSelector = RTL_LANG_PREFIXES.map(l => `[lang^="${l}"]`).join(',');
    if (!document.querySelector(rtlLangSelector)) return null;

    // Step 3: RTL language present but no dir declaration → genuine violation
    const rootElement = document.body?.firstElementChild;
    const rootTag = rootElement ? rootElement.tagName.toLowerCase() : 'div';
    const rootHtml = rootElement
        ? rootElement.outerHTML.split('>')[0] + '>'
        : '<div>';

    const sourceLines = ordinalIndex?.get(rootTag);
    const lineNumber = (sourceLines && sourceLines.length > 0)
        ? sourceLines[0]
        : findLineNumber(sourceContent, `<${rootTag}`);

    const help = 'Add dir="rtl" to your root element to support RTL languages (Hebrew, Arabic, Persian).';
    return createRtlViolation(filePath, rootHtml, lineNumber, rootTag, help);
}
