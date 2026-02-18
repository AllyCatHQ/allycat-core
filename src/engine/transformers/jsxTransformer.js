/**
 * JSX Transformer
 *
 * Converts JSX/TSX source code into scannable HTML.
 * Preserves original source line numbers via lineMap for accurate violation reporting.
 *
 * Responsibilities:
 *  - Parse JSX/TSX with Babel
 *  - Walk AST and extract JSX elements
 *  - Transform JSX attributes to HTML attributes
 *  - Return HTML string + lineMap (htmlLine → jsxSourceLine)
 *
 * @module engine/transformers/jsxTransformer
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default ?? _traverse;
import * as t from '@babel/types';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Transform JSX/TSX source code into scannable HTML
 *
 * @param {string} sourceCode - Raw JSX or TSX file contents
 * @returns {{ html: string, lineMap: Map<number, number> }}
 *   html    - Valid HTML string for JSDOM/Playwright consumption
 *   lineMap - Map of htmlLine (1-indexed) → original jsxSourceLine (1-indexed)
 */
export function transformJsxToHtml(sourceCode) {
    const ast = parseJsx(sourceCode);
    const jsxNodes = collectJsxRoots(ast);
    const { html, lineMap } = renderNodesToHtml(jsxNodes, sourceCode);

    return { html: wrapInDocument(html), lineMap };
}

/**
 * Check whether a file path is a JSX or TSX file
 *
 * @param {string} filePath - File path to check
 * @returns {boolean}
 */
export function isJsxFile(filePath) {
    return /\.(jsx|tsx)$/.test(filePath);
}

// -----------------------------------------------------------------------------
// Parsing
// -----------------------------------------------------------------------------

/**
 * Parse source code into a Babel AST
 * Supports JSX, TypeScript, and modern JS syntax
 *
 * @param {string} sourceCode
 * @returns {import('@babel/types').File}
 */
function parseJsx(sourceCode) {
    return parse(sourceCode, {
        sourceType: 'module',
        plugins: [
            'jsx',
            'typescript',
            'classProperties',
            'optionalChaining',
            'nullishCoalescingOperator',
        ],
        errorRecovery: true, // Don't crash on partial/invalid JSX
    });
}

// -----------------------------------------------------------------------------
// AST Traversal — Collect Root JSX Nodes
// -----------------------------------------------------------------------------

/**
 * Walk the AST and collect all top-level JSX elements returned by components.
 * We target return statements and arrow function bodies.
 *
 * @param {import('@babel/types').File} ast
 * @returns {Array<{ node: import('@babel/types').JSXElement, sourceCode: string }>}
 */
function collectJsxRoots(ast) {
    const roots = [];

    traverse(ast, {
        ReturnStatement(path) {
            const arg = path.node.argument;
            if (arg && (t.isJSXElement(arg) || t.isJSXFragment(arg))) {
                roots.push(arg);
            }
        },
        ArrowFunctionExpression(path) {
            const body = path.node.body;
            if (t.isJSXElement(body) || t.isJSXFragment(body)) {
                roots.push(body);
            }
        },
    });

    return roots;
}

// -----------------------------------------------------------------------------
// HTML Rendering
// -----------------------------------------------------------------------------

/**
 * Render collected JSX nodes to an HTML string with line mapping
 *
 * @param {Array} jsxNodes - Collected JSX root nodes
 * @param {string} sourceCode - Original source (used for line tracking)
 * @returns {{ html: string, lineMap: Map<number, number> }}
 */
function renderNodesToHtml(jsxNodes, sourceCode) {
    const htmlLines = [];
    const lineMap = new Map();

    for (const node of jsxNodes) {
        const rendered = renderNode(node);
        for (const { htmlLine, sourceLine } of rendered) {
            const currentHtmlLineNumber = htmlLines.length + 1;
            htmlLines.push(htmlLine);
            if (sourceLine) {
                lineMap.set(currentHtmlLineNumber, sourceLine);
            }
        }
    }

    return {
        html: htmlLines.join('\n'),
        lineMap,
    };
}

/**
 * Render a single JSX node (element, fragment, text, expression) to HTML lines
 *
 * @param {import('@babel/types').Node} node
 * @param {number} depth - Indentation depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null }>}
 */
function renderNode(node, depth = 0) {
    if (t.isJSXFragment(node)) {
        return renderChildren(node.children, depth);
    }

    if (t.isJSXElement(node)) {
        return renderElement(node, depth);
    }

    if (t.isJSXText(node)) {
        return renderText(node, depth);
    }

    if (t.isJSXExpressionContainer(node)) {
        return renderExpression(node, depth);
    }

    return [];
}

/**
 * Render a JSX element to HTML lines
 *
 * @param {import('@babel/types').JSXElement} node
 * @param {number} depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null }>}
 */
function renderElement(node, depth) {
    const indent = '  '.repeat(depth);
    const sourceLine = node.loc?.start?.line ?? null;
    const tagInfo = resolveTag(node.openingElement);
    const attributes = renderAttributes(node.openingElement.attributes);
    const isSelfClosing = node.openingElement.selfClosing;

    // Self-closing element (e.g. <img />, <br />)
    if (isSelfClosing) {
        return [{
            htmlLine: `${indent}<${tagInfo.tag}${attributes}>`,
            sourceLine,
        }];
    }

    // Opening tag
    const lines = [{
        htmlLine: `${indent}<${tagInfo.tag}${attributes}>`,
        sourceLine,
    }];

    // Children
    const childLines = renderChildren(node.children, depth + 1);
    lines.push(...childLines);

    // Closing tag
    lines.push({
        htmlLine: `${indent}</${tagInfo.tag}>`,
        sourceLine: null,
    });

    return lines;
}

/**
 * Render JSX children recursively
 *
 * @param {Array} children
 * @param {number} depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null }>}
 */
function renderChildren(children, depth) {
    const lines = [];
    for (const child of children) {
        lines.push(...renderNode(child, depth));
    }
    return lines;
}

/**
 * Render JSX text node (trim, skip whitespace-only)
 *
 * @param {import('@babel/types').JSXText} node
 * @param {number} depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null }>}
 */
function renderText(node, depth) {
    const text = node.value.trim();
    if (!text) return [];

    const indent = '  '.repeat(depth);
    return [{ htmlLine: `${indent}${text}`, sourceLine: null }];
}

/**
 * Render JSX expression container {value} as placeholder text
 * Preserves the element structure for a11y scanning
 *
 * @param {import('@babel/types').JSXExpressionContainer} node
 * @param {number} depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null }>}
 */
function renderExpression(node, depth) {
    if (t.isJSXEmptyExpression(node.expression)) return [];

    // Conditional: {condition && <Element>} → render the JSX branch
    if (t.isLogicalExpression(node.expression)) {
        const right = node.expression.right;
        if (t.isJSXElement(right) || t.isJSXFragment(right)) {
            return renderNode(right, depth);
        }
    }

    // Ternary: {cond ? <A /> : <B />} → render both branches
    if (t.isConditionalExpression(node.expression)) {
        const lines = [];
        const { consequent, alternate } = node.expression;
        if (t.isJSXElement(consequent) || t.isJSXFragment(consequent)) {
            lines.push(...renderNode(consequent, depth));
        }
        if (t.isJSXElement(alternate) || t.isJSXFragment(alternate)) {
            lines.push(...renderNode(alternate, depth));
        }
        return lines;
    }

    // Plain expression {variable} → placeholder
    const indent = '  '.repeat(depth);
    return [{ htmlLine: `${indent}placeholder`, sourceLine: null }];
}

// -----------------------------------------------------------------------------
// Tag & Attribute Resolution
// -----------------------------------------------------------------------------

/**
 * Resolve a JSX opening element to its HTML tag name.
 * Custom components (uppercase) become <div data-component="Name">.
 *
 * @param {import('@babel/types').JSXOpeningElement} openingElement
 * @returns {{ tag: string, isCustom: boolean }}
 */
function resolveTag(openingElement) {
    const nameNode = openingElement.name;

    // Standard HTML tag: <div>, <button>, <img>, etc.
    if (t.isJSXIdentifier(nameNode) && isHtmlTag(nameNode.name)) {
        return { tag: nameNode.name, isCustom: false };
    }

    // Member expression: <Namespace.Component> → div
    if (t.isJSXMemberExpression(nameNode)) {
        const componentName = `${nameNode.object.name}.${nameNode.property.name}`;
        return { tag: 'div', isCustom: true, componentName };
    }

    // Custom component: <Button>, <Icon>, etc. → div with data attribute
    const componentName = t.isJSXIdentifier(nameNode) ? nameNode.name : 'Unknown';
    return { tag: 'div', isCustom: true, componentName };
}

/**
 * Render JSX attributes to an HTML attribute string.
 * Handles: className→class, htmlFor→for, event handlers (removed),
 * boolean attributes, dynamic values (placeholder).
 *
 * @param {Array} attributes - JSX attribute nodes
 * @returns {string} - HTML attribute string (e.g., ' class="btn" id="main"')
 */
function renderAttributes(attributes) {
    const parts = [];

    for (const attr of attributes) {
        // Spread attributes: {...props} → skip
        if (t.isJSXSpreadAttribute(attr)) continue;

        const name = attr.name.name;
        const htmlAttr = mapAttributeName(name);

        // Drop event handlers (onClick, onFocus, etc.)
        if (htmlAttr === null) continue;

        // Boolean attribute: <input disabled />
        if (attr.value === null) {
            parts.push(htmlAttr);
            continue;
        }

        // String literal value: className="btn"
        if (t.isStringLiteral(attr.value)) {
            parts.push(`${htmlAttr}="${escapeAttr(attr.value.value)}"`);
            continue;
        }

        // Expression value: alt={getAlt()}, src={imgUrl}
        if (t.isJSXExpressionContainer(attr.value)) {
            const value = resolveExpressionValue(attr.value.expression, htmlAttr);
            if (value !== null) {
                parts.push(`${htmlAttr}="${value}"`);
            }
            continue;
        }
    }

    return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

/**
 * Map JSX attribute name to HTML attribute name.
 * Returns null for attributes that should be dropped.
 *
 * @param {string} jsxAttr
 * @returns {string|null}
 */
function mapAttributeName(jsxAttr) {
    const DROP = null;
    const map = {
        className:       'class',
        htmlFor:         'for',
        tabIndex:        'tabindex',
        readOnly:        'readonly',
        maxLength:       'maxlength',
        colSpan:         'colspan',
        rowSpan:         'rowspan',
        crossOrigin:     'crossorigin',
        autoComplete:    'autocomplete',
        autoFocus:       'autofocus',
        encType:         'enctype',
        contentEditable: 'contenteditable',
        spellCheck:      'spellcheck',
        // Drop all event handlers
        onClick:         DROP,
        onChange:        DROP,
        onSubmit:        DROP,
        onFocus:         DROP,
        onBlur:          DROP,
        onKeyDown:       DROP,
        onKeyUp:         DROP,
        onKeyPress:      DROP,
        onMouseEnter:    DROP,
        onMouseLeave:    DROP,
        onMouseOver:     DROP,
        onMouseOut:      DROP,
        onInput:         DROP,
        onLoad:          DROP,
        onError:         DROP,
    };

    if (jsxAttr in map) return map[jsxAttr];

    // Drop any remaining on* handlers not in the map above
    if (jsxAttr.startsWith('on') && jsxAttr[2] === jsxAttr[2]?.toUpperCase()) {
        return DROP;
    }

    return jsxAttr; // Pass through as-is (aria-*, data-*, role, etc.)
}

/**
 * Resolve a JSX expression value to a string for HTML output.
 * Dynamic expressions become "dynamic" — preserving the attribute for a11y scanning.
 *
 * @param {import('@babel/types').Expression} expression
 * @param {string} attrName - The HTML attribute name (context)
 * @returns {string|null}
 */
function resolveExpressionValue(expression, attrName) {
    // String literal inside expression: alt={"text"}
    if (t.isStringLiteral(expression)) {
        return escapeAttr(expression.value);
    }

    // Boolean false: hidden={false} → skip attribute
    if (t.isBooleanLiteral(expression) && !expression.value) {
        return null;
    }

    // Boolean true: hidden={true} → include as boolean
    if (t.isBooleanLiteral(expression) && expression.value) {
        return 'true';
    }

    // Numeric literal: tabIndex={0}
    if (t.isNumericLiteral(expression)) {
        return String(expression.value);
    }

    // Dynamic value: flag as "dynamic" — preserves the attribute on the element
    // so axe-core can detect missing alt, aria-label etc.
    return 'dynamic';
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Wrap rendered HTML fragments in a full HTML document structure.
 * Required for JSDOM and Playwright to process correctly.
 *
 * @param {string} bodyContent
 * @returns {string}
 */
function wrapInDocument(bodyContent) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>A11y Scan</title></head>
<body>
${bodyContent}
</body>
</html>`;
}

/**
 * Known HTML tags — used to distinguish native elements from custom components
 * @type {Set<string>}
 */
const HTML_TAGS = new Set([
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

/**
 * Check if a tag name is a native HTML element
 *
 * @param {string} name
 * @returns {boolean}
 */
function isHtmlTag(name) {
    return HTML_TAGS.has(name.toLowerCase());
}

/**
 * Escape a string for safe use in an HTML attribute value
 *
 * @param {string} value
 * @returns {string}
 */
function escapeAttr(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}