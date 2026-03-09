/**
 * JSX Renderer
 *
 * Walks a collected JSX AST and renders it to an HTML string.
 * Simultaneously builds two position indexes:
 *   lineMap      — htmlLine → jsxSourceLine
 *   ordinalIndex — tagName → [jsxSourceLine, ...] (document order)
 *
 * @module engine/transformers/jsxRenderer
 */

import * as t from '@babel/types';
import { HTML_TAGS, registerOrdinalEntry } from './transformerUtils.js';
import { renderAttributes } from './jsxAttributeMapper.js';

// -----------------------------------------------------------------------------
// Public API
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
 * @param {Map<string, string>} cssModuleBindings  localName → cssFilePath
 * @returns {{ html: string, lineMap: Map<number, number>, ordinalIndex: Map<string, number[]> }}
 */
export function renderNodesToHtml(jsxNodes, cssModuleBindings) {
    const htmlLines = [];
    const lineMap = new Map();
    const ordinalIndex = new Map();

    for (const node of jsxNodes) {
        const renderedLines = renderNode(node, 0, cssModuleBindings);

        for (const { htmlLine, sourceLine, tag } of renderedLines) {
            const currentHtmlLineNumber = htmlLines.length + 1;
            htmlLines.push(htmlLine);

            if (sourceLine !== null) {
                lineMap.set(currentHtmlLineNumber, sourceLine);

                if (tag) {
                    registerOrdinalEntry(ordinalIndex, tag, sourceLine);
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

// -----------------------------------------------------------------------------
// Node Rendering
// -----------------------------------------------------------------------------

/**
 * Render a single JSX node to an array of output lines.
 * Each line carries: { htmlLine, sourceLine, tag }
 *   htmlLine   — the rendered HTML string for this line
 *   sourceLine — original JSX source line (null for structural lines)
 *   tag        — lowercase tag name (null for non-element lines)
 *
 * @param {import('@babel/types').Node} node
 * @param {number} depth - Indentation depth
 * @param {Map<string, string>} cssModuleBindings  localName → cssFilePath
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderNode(node, depth = 0, cssModuleBindings = new Map()) {
    if (t.isJSXFragment(node)) return renderChildren(node.children, depth, cssModuleBindings);
    if (t.isJSXElement(node)) return renderElement(node, depth, cssModuleBindings);
    if (t.isJSXText(node)) return renderText(node, depth);
    if (t.isJSXExpressionContainer(node)) return renderExpression(node, depth, cssModuleBindings);
    return [];
}

/**
 * Render a JSX element to output lines.
 *
 * @param {import('@babel/types').JSXElement} node
 * @param {number} depth
 * @param {Map<string, string>} cssModuleBindings
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderElement(node, depth, cssModuleBindings) {
    const indent = '  '.repeat(depth);
    const sourceLine = node.loc?.start?.line ?? null;
    const tagInfo = resolveTag(node.openingElement);
    const attributes = renderAttributes(node.openingElement.attributes, cssModuleBindings);
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

    lines.push(...renderChildren(node.children, depth + 1, cssModuleBindings));

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
 * @param {Map<string, string>} cssModuleBindings
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderChildren(children, depth, cssModuleBindings) {
    const lines = [];
    for (const child of children) {
        lines.push(...renderNode(child, depth, cssModuleBindings));
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
 * @param {Map<string, string>} cssModuleBindings
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderExpression(node, depth, cssModuleBindings) {
    if (t.isJSXEmptyExpression(node.expression)) return [];

    const logicalLines = renderLogicalExpression(node.expression, depth, cssModuleBindings);
    if (logicalLines !== null) return logicalLines;

    const conditionalLines = renderConditionalExpression(node.expression, depth, cssModuleBindings);
    if (conditionalLines !== null) return conditionalLines;

    const indent = '  '.repeat(depth);
    return [{ htmlLine: `${indent}placeholder`, sourceLine: null, tag: null }];
}

/**
 * Render the right-hand side of a logical expression if it is JSX.
 * Returns null if the expression is not logical, or its right side is not JSX.
 *
 * @param {import('@babel/types').Expression} expression
 * @param {number} depth
 * @param {Map<string, string>} cssModuleBindings
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>|null}
 */
function renderLogicalExpression(expression, depth, cssModuleBindings) {
    if (!t.isLogicalExpression(expression)) return null;
    const right = expression.right;
    if (t.isJSXElement(right) || t.isJSXFragment(right)) {
        return renderNode(right, depth, cssModuleBindings);
    }
    return null;
}

/**
 * Render both branches of a conditional (ternary) expression.
 * Returns null if the expression is not a conditional expression.
 *
 * @param {import('@babel/types').Expression} expression
 * @param {number} depth
 * @param {Map<string, string>} cssModuleBindings
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>|null}
 */
function renderConditionalExpression(expression, depth, cssModuleBindings) {
    if (!t.isConditionalExpression(expression)) return null;
    const lines = [];
    const { consequent, alternate } = expression;
    if (t.isJSXElement(consequent) || t.isJSXFragment(consequent)) {
        lines.push(...renderNode(consequent, depth, cssModuleBindings));
    }
    if (t.isJSXElement(alternate) || t.isJSXFragment(alternate)) {
        lines.push(...renderNode(alternate, depth, cssModuleBindings));
    }
    return lines;
}

// -----------------------------------------------------------------------------
// Tag Resolution
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
 * Check if a tag name is a native HTML element.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isHtmlTag(name) {
    return HTML_TAGS.has(name.toLowerCase());
}
