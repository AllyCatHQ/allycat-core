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
// HTML wrapper offset
// -----------------------------------------------------------------------------

/**
 * Number of lines added before body content by wrapInDocument.
 * All transformers export this value so violationProcessor can subtract it
 * from axe's reported line numbers to recover the original source line.
 *
 * Matches the structure of wrapInDocument() — count lines before ${bodyContent}:
 *   line 1: <!DOCTYPE html>
 *   line 2: <html lang="en">
 *   line 3: <head>...</head>
 *   line 4: <body>
 *   line 5: ${bodyContent} starts here → offset = 4
 *
 * @type {number}
 */
export const HTML_WRAPPER_OFFSET = 4;

// -----------------------------------------------------------------------------
// Ordinal index tracking
// -----------------------------------------------------------------------------

/**
 * Append a source line to the ordinalIndex for the given tag.
 * Creates the tag entry if it does not already exist.
 *
 * Shared by all transformers — JSX, Vue, and Angular build the same
 * ordinalIndex structure during their rendering passes.
 *
 * @param {Map<string, number[]>} ordinalIndex
 * @param {string} tag
 * @param {number} sourceLine
 */
export function registerOrdinalEntry(ordinalIndex, tag, sourceLine) {
    if (!ordinalIndex.has(tag)) ordinalIndex.set(tag, []);
    ordinalIndex.get(tag).push(sourceLine);
}

// -----------------------------------------------------------------------------
// CSS-in-JS detection
// -----------------------------------------------------------------------------

const CSS_IN_JS_LIBS = [
    'styled-components',
    '@emotion/react',
    '@emotion/styled',
    '@emotion/css',
    'styled-jsx/css',    // Next.js built-in
    '@stitches/react',   // runtime CSS-in-JS (deprecated but still in use)
];

const CSS_IN_JS_RE = new RegExp(
    `from\\s+['"](?:${CSS_IN_JS_LIBS.map(l => l.replace(/\//g, '\\/')).join('|')})['"]`
);

/**
 * Detect CSS-in-JS library usage in source code.
 *
 * Returns the matched library name, or null if none found.
 * Used by scanners to emit a warning before scanning JSX/TSX files
 * that use runtime-generated styles (which cannot be statically injected).
 *
 * @param {string} source - File source content
 * @returns {string|null}
 */
export function detectCssInJs(source) {
    if (!CSS_IN_JS_RE.test(source)) return null;
    return CSS_IN_JS_LIBS.find(lib =>
        source.includes(`'${lib}'`) || source.includes(`"${lib}"`)
    ) ?? 'CSS-in-JS';
}

// -----------------------------------------------------------------------------
// HTML tag reference
// -----------------------------------------------------------------------------

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

export const VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);
