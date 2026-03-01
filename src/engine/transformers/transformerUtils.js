/**
 * Shared transformer utilities
 *
 * Used by jsxTransformer, vueTransformer, and angularTransformer.
 * Centralises code that was previously duplicated across all three.
 *
 * @module engine/transformers/transformerUtils
 */

// -----------------------------------------------------------------------------
// Document wrapper
// -----------------------------------------------------------------------------

/**
 * Wrap rendered HTML in a minimal full-page document shell.
 *
 * Line count before ${bodyContent} MUST stay at 4 — all transformers export
 * HTML_WRAPPER_OFFSET = 4, which violationProcessor uses to adjust axe line numbers.
 *
 * Structure:
 *   line 1 → <!DOCTYPE html>
 *   line 2 → <html lang="en">
 *   line 3 → <head>...</head>
 *   line 4 → <body>
 *   line 5 → ${bodyContent} starts here  → offset = 4
 *
 * @param {string} bodyContent
 * @returns {string}
 */
export function wrapInDocument(bodyContent) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>A11y Scan</title></head>
<body>
${bodyContent}
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Attribute escaping
// -----------------------------------------------------------------------------

/**
 * Escape a value for safe use inside an HTML attribute (double-quoted).
 *
 * @param {string} value
 * @returns {string}
 */
export function escapeAttr(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// -----------------------------------------------------------------------------
// HTML tag reference
// -----------------------------------------------------------------------------

/**
 * Complete set of known HTML element names (lowercase).
 * Used by all transformers to distinguish native HTML from custom components.
 *
 * @type {Set<string>}
 */
export const HTML_TAGS = new Set([
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
    'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button',
    'canvas', 'caption', 'cite', 'code', 'col', 'colgroup',
    'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
    'em', 'embed',
    'fieldset', 'figcaption', 'figure', 'footer', 'form',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html',
    'i', 'iframe', 'img', 'input', 'ins',
    'kbd',
    'label', 'legend', 'li', 'link',
    'main', 'map', 'mark', 'menu', 'meta', 'meter',
    'nav', 'noscript',
    'object', 'ol', 'optgroup', 'option', 'output',
    'p', 'picture', 'pre', 'progress',
    'q',
    's', 'samp', 'script', 'section', 'select', 'small', 'source', 'span',
    'strong', 'style', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead',
    'time', 'title', 'tr', 'track',
    'u', 'ul',
    'var', 'video',
    'wbr',
]);
