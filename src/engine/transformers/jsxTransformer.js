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
 *  - Return ordinalIndex (tag → [sourceLine, ...]) for position-based lookup
 *
 * @module engine/transformers/jsxTransformer
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default ?? _traverse;
import * as t from '@babel/types';
import { wrapInDocument, escapeAttr, HTML_TAGS } from './transformerUtils.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Transform JSX/TSX source code into scannable HTML.
 *
 * Returns three artifacts:
 *   html         — valid HTML string for JSDOM/Playwright consumption
 *   lineMap      — Map<htmlLineNumber, jsxSourceLine> (1-indexed)
 *   ordinalIndex — Map<tagName, Array<jsxSourceLine>>
 *                  The array is in document order. Index 0 = first occurrence,
 *                  index 1 = second occurrence, etc.
 *                  Used by scannerUtils to resolve violations for identical elements.
 *
 * @param {string} sourceCode - Raw JSX or TSX file contents
 * @returns {{ html: string, lineMap: Map<number, number>, ordinalIndex: Map<string, number[]> }}
 */
export function transformJsxToHtml(sourceCode) {
    const ast = parseJsx(sourceCode);
    const jsxNodes = collectJsxRoots(ast);
    const { html, lineMap, ordinalIndex } = renderNodesToHtml(jsxNodes);

    return { html: wrapInDocument(html), lineMap, ordinalIndex };
}

/**
 * Check whether a file path is a JSX or TSX file
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isJsxFile(filePath) {
    return /\.(jsx|tsx)$/.test(filePath);
}

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Number of lines added before body content by wrapInDocument.
 * Used by scannerUtils to correctly offset lineMap lookups.
 *
 * Matches the structure of wrapInDocument() below — count the lines
 * before ${bodyContent} starts:
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
// Parsing
// -----------------------------------------------------------------------------

/**
 * Parse source code into a Babel AST.
 * Supports JSX, TypeScript, and modern JS syntax.
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
        errorRecovery: true,
    });
}

// -----------------------------------------------------------------------------
// AST Traversal — Collect Root JSX Nodes
// -----------------------------------------------------------------------------

/**
 * Walk the AST and collect all top-level JSX elements returned by components.
 *
 * @param {import('@babel/types').File} ast
 * @returns {Array<import('@babel/types').JSXElement|import('@babel/types').JSXFragment>}
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
 * Render collected JSX nodes to an HTML string with full position tracking.
 *
 * Builds two indexes simultaneously during a single document-order traversal:
 *
 *   lineMap      — maps each rendered HTML line number back to the JSX source
 *                  line that produced it. Used for direct line lookups.
 *
 *   ordinalIndex — for each tag name, records the JSX source line of every
 *                  occurrence in document order.
 *                  ordinalIndex.get('button') = [20, 21, 22]
 *                  means the 1st button is at JSX line 20, 2nd at 21, etc.
 *                  This enables O(1) lookup for any nth occurrence of any tag.
 *
 * @param {Array} jsxNodes
 * @returns {{ html: string, lineMap: Map<number, number>, ordinalIndex: Map<string, number[]> }}
 */
function renderNodesToHtml(jsxNodes) {
    const htmlLines = [];
    const lineMap = new Map();
    const ordinalIndex = new Map();

    for (const node of jsxNodes) {
        const rendered = renderNode(node);

        for (const { htmlLine, sourceLine, tag } of rendered) {
            const currentHtmlLineNumber = htmlLines.length + 1;
            htmlLines.push(htmlLine);

            if (sourceLine !== null) {
                // lineMap: html line → source line
                lineMap.set(currentHtmlLineNumber, sourceLine);

                // ordinalIndex: tag → [sourceLine in document order]
                if (tag) {
                    if (!ordinalIndex.has(tag)) {
                        ordinalIndex.set(tag, []);
                    }
                    ordinalIndex.get(tag).push(sourceLine);
                }
            }
        }
    }

    return {
        html: htmlLines.join('\n'),
        lineMap,
        ordinalIndex,
    };
}

/**
 * Render a single JSX node to an array of output lines.
 * Each line carries: { htmlLine, sourceLine, tag }
 *   htmlLine   — the rendered HTML string for this line
 *   sourceLine — original JSX source line (null for structural lines)
 *   tag        — lowercase tag name (null for non-element lines)
 *
 * @param {import('@babel/types').Node} node
 * @param {number} depth - Indentation depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderNode(node, depth = 0) {
    if (t.isJSXFragment(node)) return renderChildren(node.children, depth);
    if (t.isJSXElement(node)) return renderElement(node, depth);
    if (t.isJSXText(node)) return renderText(node, depth);
    if (t.isJSXExpressionContainer(node)) return renderExpression(node, depth);
    return [];
}

/**
 * Render a JSX element to output lines.
 *
 * @param {import('@babel/types').JSXElement} node
 * @param {number} depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderElement(node, depth) {
    const indent = '  '.repeat(depth);
    const sourceLine = node.loc?.start?.line ?? null;
    const tagInfo = resolveTag(node.openingElement);
    const attributes = renderAttributes(node.openingElement.attributes);
    const isSelfClosing = node.openingElement.selfClosing;

    if (isSelfClosing) {
        return [{
            htmlLine: `${indent}<${tagInfo.tag}${attributes}>`,
            sourceLine,
            tag: tagInfo.tag,
        }];
    }

    const lines = [{
        htmlLine: `${indent}<${tagInfo.tag}${attributes}>`,
        sourceLine,
        tag: tagInfo.tag,
    }];

    lines.push(...renderChildren(node.children, depth + 1));

    lines.push({
        htmlLine: `${indent}</${tagInfo.tag}>`,
        sourceLine: null,
        tag: null,
    });

    return lines;
}

/**
 * Render JSX children recursively.
 *
 * @param {Array} children
 * @param {number} depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderChildren(children, depth) {
    const lines = [];
    for (const child of children) {
        lines.push(...renderNode(child, depth));
    }
    return lines;
}

/**
 * Render a JSX text node.
 *
 * @param {import('@babel/types').JSXText} node
 * @param {number} depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderText(node, depth) {
    const text = node.value.trim();
    if (!text) return [];
    const indent = '  '.repeat(depth);
    return [{ htmlLine: `${indent}${text}`, sourceLine: null, tag: null }];
}

/**
 * Render a JSX expression container.
 * Handles logical expressions, ternaries, and plain expressions.
 *
 * @param {import('@babel/types').JSXExpressionContainer} node
 * @param {number} depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderExpression(node, depth) {
    if (t.isJSXEmptyExpression(node.expression)) return [];

    if (t.isLogicalExpression(node.expression)) {
        const right = node.expression.right;
        if (t.isJSXElement(right) || t.isJSXFragment(right)) {
            return renderNode(right, depth);
        }
    }

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

    const indent = '  '.repeat(depth);
    return [{ htmlLine: `${indent}placeholder`, sourceLine: null, tag: null }];
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

    if (t.isJSXIdentifier(nameNode) && isHtmlTag(nameNode.name)) {
        return { tag: nameNode.name, isCustom: false };
    }

    if (t.isJSXMemberExpression(nameNode)) {
        const componentName = `${nameNode.object.name}.${nameNode.property.name}`;
        return { tag: 'div', isCustom: true, componentName };
    }

    const componentName = t.isJSXIdentifier(nameNode) ? nameNode.name : 'Unknown';
    return { tag: 'div', isCustom: true, componentName };
}

/**
 * Render JSX attributes to an HTML attribute string.
 * Handles: className→class, htmlFor→for, event handlers (removed),
 * boolean attributes, dynamic values.
 *
 * @param {Array} attributes - JSX attribute nodes
 * @returns {string} - HTML attribute string
 */
function renderAttributes(attributes) {
    const parts = [];

    for (const attr of attributes) {
        if (t.isJSXSpreadAttribute(attr)) continue;

        const name = attr.name.name;
        const htmlAttr = mapAttributeName(name);

        if (isEventHandler(name)) continue;

        if (attr.value === null) {
            parts.push(htmlAttr);
            continue;
        }

        if (t.isStringLiteral(attr.value)) {
            parts.push(`${htmlAttr}="${escapeAttr(attr.value.value)}"`);
            continue;
        }
        // Style object: style={{ color: '#fff', backgroundColor: '#000' }}
        // Must be handled before the generic expression resolver,
        // because ObjectExpression → "dynamic" by default.
        if (htmlAttr === 'style' && t.isJSXExpressionContainer(attr.value)) {
            const cssString = resolveStyleObject(attr.value.expression);
            if (cssString) {
                parts.push(`style="${cssString}"`);
            }
            continue;
        }

        // Expression value: alt={getAlt()}, src={imgUrl}
        if (t.isJSXExpressionContainer(attr.value)) {
            const resolved = resolveExpressionValue(attr.value.expression, htmlAttr);
            if (resolved === null) continue;
            parts.push(`${htmlAttr}="${resolved}"`);
        }
    }

    return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

/**
 * Map JSX attribute names to their HTML equivalents.
 *
 * @param {string} name - JSX attribute name
 * @returns {string} - HTML attribute name
 */
function mapAttributeName(name) {
    const map = {
        className: 'class',
        htmlFor: 'for',
        tabIndex: 'tabindex',
        readOnly: 'readonly',
        autoComplete: 'autocomplete',
        autoFocus: 'autofocus',
        crossOrigin: 'crossorigin',
        encType: 'enctype',
        noValidate: 'novalidate',
        useMap: 'usemap',
        contentEditable: 'contenteditable',
    };
    return map[name] || name;
}

/**
 * Check if an attribute name is an event handler (onClick, onFocus, etc.)
 *
 * @param {string} name
 * @returns {boolean}
 */
function isEventHandler(name) {
    return name.startsWith('on') && name.length > 2 && name[2] === name[2].toUpperCase();
}

/**
 * Resolve a JSX expression value to a string for HTML output.
 *
 * @param {import('@babel/types').Expression} expression
 * @param {string} attrName
 * @returns {string|null}
 */
function resolveExpressionValue(expression, attrName) {
    if (t.isStringLiteral(expression)) return escapeAttr(expression.value);
    if (t.isBooleanLiteral(expression) && !expression.value) return null;
    if (t.isBooleanLiteral(expression) && expression.value) return 'true';
    if (t.isNumericLiteral(expression)) return String(expression.value);
    return 'dynamic';
}

/**
 * Serialize a JSX style ObjectExpression to a valid CSS string.
 *
 * Handles:
 *   style={{ color: '#fff' }}           → "color: #fff"
 *   style={{ backgroundColor: '#000' }} → "background-color: #000"
 *   style={{ fontSize: '16px' }}        → "font-size: 16px"
 *
 * Skips spread props and computed/dynamic values.
 * Returns null if expression is not an ObjectExpression (e.g. a variable).
 *
 * @param {import('@babel/types').Expression} expression
 * @returns {string|null}
 */
function resolveStyleObject(expression) {
    if (!t.isObjectExpression(expression)) return null;

    const declarations = [];

    for (const prop of expression.properties) {
        // Skip spread: { ...baseStyle }
        if (t.isSpreadElement(prop) || t.isRestElement(prop)) continue;
        // Skip computed keys: { [key]: value }
        if (prop.computed) continue;

        const key = t.isIdentifier(prop.key)
            ? prop.key.name
            : t.isStringLiteral(prop.key)
                ? prop.key.value
                : null;

        if (!key) continue;

        // Only serialize string and numeric literal values —
        // variables and expressions are unknowable statically.
        let value = null;
        if (t.isStringLiteral(prop.value)) {
            value = prop.value.value;
        } else if (t.isNumericLiteral(prop.value)) {
            value = String(prop.value.value);
        }

        if (!value) continue;

        // camelCase → kebab-case: backgroundColor → background-color
        const cssProperty = key.replace(/([A-Z])/g, '-$1').toLowerCase();
        declarations.push(`${cssProperty}: ${value}`);
    }

    return declarations.length > 0 ? declarations.join('; ') : null;
}
// wrapInDocument, escapeAttr, HTML_TAGS — imported from transformerUtils.js

/**
 * Check if a tag name is a native HTML element.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isHtmlTag(name) {
    return HTML_TAGS.has(name.toLowerCase());
}