/**
 * Vue Transformer
 *
 * Converts Vue SFC <template> blocks into scannable HTML.
 * Preserves original source line numbers via lineMap for accurate violation reporting.
 *
 * Responsibilities:
 *  - Extract <template> block from .vue file (records line offset)
 *  - Parse template with @vue/compiler-dom
 *  - Walk AST and render HTML elements
 *  - Transform Vue directives/bindings to HTML attributes
 *  - Return HTML string + lineMap (htmlLine → vueSourceLine)
 *  - Return ordinalIndex (tag → [sourceLine, ...]) for position-based lookup
 *
 * @module engine/transformers/vueTransformer
 */

import { parse, NodeTypes } from '@vue/compiler-dom';
import { wrapInDocument, escapeAttr, HTML_TAGS } from './transformerUtils.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Transform a Vue SFC source file into scannable HTML.
 *
 * Returns three artifacts:
 *   html         — valid HTML string for JSDOM/Playwright consumption
 *   lineMap      — Map<htmlLineNumber, vueSourceLine> (1-indexed)
 *   ordinalIndex — Map<tagName, Array<vueSourceLine>>
 *
 * @param {string} sourceCode - Raw .vue file contents
 * @returns {{ html: string, lineMap: Map<number, number>, ordinalIndex: Map<string, number[]> }}
 */
export function transformVueToHtml(sourceCode) {
    const extracted = extractTemplateBlock(sourceCode);
    if (!extracted) {
        return { html: wrapInDocument(''), lineMap: new Map(), ordinalIndex: new Map() };
    }

    const { content, lineOffset } = extracted;
    const ast = parse(content, { onWarn: () => {} });
    const { html, lineMap, ordinalIndex } = renderNodesToHtml(ast.children, lineOffset);

    return { html: wrapInDocument(html), lineMap, ordinalIndex };
}

/**
 * Check whether a file path is a Vue SFC
 *
 * @param {string} filePath
 * @returns {boolean}
 */
export function isVueFile(filePath) {
    return /\.vue$/.test(filePath);
}

/**
 * Extract raw CSS content from all <style> blocks in a Vue SFC.
 *
 * Handles: <style>, <style scoped>, <style module>, and any combination
 * of attributes. The raw CSS string is extracted as-is — no hash transformation
 * is applied (scoped hashes are a build-time concern, not needed for a11y scanning).
 *
 * HTML comments are stripped before searching so `<!-- <style>...</style> -->`
 * inside a <template> block does not produce a false CSS match.
 *
 * @param {string} sourceCode - Raw .vue file contents
 * @returns {string[]} - Array of raw CSS strings (one per <style> block found)
 */
export function extractStyleBlocks(sourceCode) {
    // Strip HTML comments so commented-out <style> blocks in <template> are ignored
    const stripped = sourceCode.replace(/<!--[\s\S]*?-->/g, '');
    const blocks = [];
    // Match <style> with any optional attributes (scoped, module, lang="scss", etc.)
    const pattern = /<style(?:\s[^>]*)?>([^]*?)<\/style>/gi;
    let match;
    while ((match = pattern.exec(stripped)) !== null) {
        const content = match[1].trim();
        if (content) blocks.push(content);
    }
    return blocks;
}

/**
 * Number of lines added before body content by wrapInDocument.
 * Matches HTML_WRAPPER_OFFSET in jsxTransformer — same document shell.
 *
 * @type {number}
 */
export const HTML_WRAPPER_OFFSET = 4;

// -----------------------------------------------------------------------------
// Template Extraction
// -----------------------------------------------------------------------------

/**
 * Extract the raw content between <template> and </template>.
 * Records lineOffset so parser line numbers can be mapped back to source lines.
 *
 * lineOffset formula: actualSourceLine = parsedLine + lineOffset
 *   If <template> is at file line 3 (1-indexed), lineOffset = 3.
 *   Parser gives node at line 1 → actual source line = 1 + 3 = 4. ✓
 *
 * @param {string} sourceCode
 * @returns {{ content: string, lineOffset: number } | null}
 */
function extractTemplateBlock(sourceCode) {
    const lines = sourceCode.split('\n');
    let startLine = -1;

    for (let i = 0; i < lines.length; i++) {
        if (/^<template(\s.*)?>\s*$/.test(lines[i].trim()) && startLine === -1) {
            startLine = i;
            break;
        }
    }

    if (startLine === -1) return null;

    // Track nesting so inner <template v-if> / <template v-for> don't
    // fool us into stopping at their </template> instead of the outer one.
    let depth = 1;
    let endLine = -1;
    for (let i = startLine + 1; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (/^<template(\s.*)?>\s*$/.test(trimmed)) depth++;
        else if (/^<\/template>/.test(trimmed)) {
            depth--;
            if (depth === 0) { endLine = i; break; }
        }
    }

    if (endLine === -1) return null;

    const content = lines.slice(startLine + 1, endLine).join('\n');

    // startLine is 0-indexed. <template> sits at file line (startLine + 1) in 1-indexed terms.
    // Content starts one line below that, so parsedLine + (startLine + 1) = actual 1-indexed line.
    const lineOffset = startLine + 1;

    return { content, lineOffset };
}

// -----------------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------------

/**
 * Render Vue AST nodes to an HTML string with full position tracking.
 *
 * Produces a flat list of { htmlLine, sourceLine, tag } entries,
 * then builds lineMap and ordinalIndex in a single pass — same pattern
 * as jsxTransformer.renderNodesToHtml().
 *
 * @param {Array} nodes - Vue compiler AST children
 * @param {number} lineOffset - Line offset to add to every parsed line number
 * @returns {{ html: string, lineMap: Map<number, number>, ordinalIndex: Map<string, number[]> }}
 */
function renderNodesToHtml(nodes, lineOffset) {
    const items = [];
    for (const node of nodes) {
        items.push(...renderNode(node, 0, lineOffset));
    }

    const htmlLines = [];
    const lineMap = new Map();
    const ordinalIndex = new Map();

    for (const { htmlLine, sourceLine, tag } of items) {
        const lineNum = htmlLines.length + 1;
        htmlLines.push(htmlLine);

        if (sourceLine !== null) {
            lineMap.set(lineNum, sourceLine);

            if (tag) {
                if (!ordinalIndex.has(tag)) ordinalIndex.set(tag, []);
                ordinalIndex.get(tag).push(sourceLine);
            }
        }
    }

    return { html: htmlLines.join('\n'), lineMap, ordinalIndex };
}

/**
 * Dispatch rendering by node type.
 *
 * @param {Object} node - Vue compiler AST node
 * @param {number} depth - Indentation depth
 * @param {number} lineOffset
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderNode(node, depth, lineOffset) {
    switch (node.type) {
        case NodeTypes.ELEMENT: return renderElement(node, depth, lineOffset);
        case NodeTypes.TEXT:    return renderText(node, depth);
        default:                return [];
    }
}

/**
 * Render a Vue element node to output lines.
 *
 * Handles:
 *   - Native HTML elements → rendered as-is
 *   - <template> (inner grouping) → fragment, renders children only, no wrapper
 *   - <slot> → rendered as <span>
 *   - <Transition>, <RouterLink>, etc. → mapped to semantic HTML
 *   - Custom components (PascalCase / kebab) → <div data-component="Name">
 *
 * @param {Object} node - Vue ELEMENT node
 * @param {number} depth
 * @param {number} lineOffset
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderElement(node, depth, lineOffset) {
    const parsedLine = node.loc?.start?.line ?? null;
    const sourceLine = parsedLine !== null ? parsedLine + lineOffset : null;
    const indent = '  '.repeat(depth);

    const { tag, isFragment } = resolveTag(node.tag);

    // <template v-if> / <template v-for> → render children without wrapper
    if (isFragment) {
        const lines = [];
        for (const child of node.children) {
            lines.push(...renderNode(child, depth, lineOffset));
        }
        return lines;
    }

    const attributes = renderAttributes(node.props);
    const isSelfClosing = node.isSelfClosing || VOID_ELEMENTS.has(tag);

    if (isSelfClosing) {
        return [{ htmlLine: `${indent}<${tag}${attributes}>`, sourceLine, tag }];
    }

    const lines = [{ htmlLine: `${indent}<${tag}${attributes}>`, sourceLine, tag }];

    for (const child of node.children) {
        lines.push(...renderNode(child, depth + 1, lineOffset));
    }

    lines.push({ htmlLine: `${indent}</${tag}>`, sourceLine: null, tag: null });

    return lines;
}

/**
 * Render a Vue text node.
 *
 * @param {Object} node - Vue TEXT node
 * @param {number} depth
 * @returns {Array<{ htmlLine: string, sourceLine: number|null, tag: string|null }>}
 */
function renderText(node, depth) {
    const text = node.content?.trim?.() ?? '';
    if (!text) return [];
    const indent = '  '.repeat(depth);
    return [{ htmlLine: `${indent}${text}`, sourceLine: null, tag: null }];
}

// -----------------------------------------------------------------------------
// Tag Resolution
// -----------------------------------------------------------------------------

/**
 * HTML void elements — rendered without a closing tag.
 * @type {Set<string>}
 */
const VOID_ELEMENTS = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

/**
 * Resolve a Vue tag name to its HTML equivalent.
 *
 * @param {string} tagName - Raw tag name from AST
 * @returns {{ tag: string|null, isFragment: boolean }}
 */
function resolveTag(tagName) {
    const lower = tagName.toLowerCase();

    // Inner <template> → used for grouping (v-if, v-for), render as fragment
    if (lower === 'template') return { tag: null, isFragment: true };

    // Vue built-in elements → map to semantic HTML
    if (lower === 'slot')                                               return { tag: 'span', isFragment: false };
    if (lower === 'transition' || lower === 'transitiongroup')          return { tag: 'div',  isFragment: false };
    if (lower === 'router-link' || lower === 'routerlink' ||
        lower === 'nuxt-link'   || lower === 'nuxtlink')                return { tag: 'a',    isFragment: false };
    if (lower === 'keep-alive'  || lower === 'keepalive')               return { tag: 'div',  isFragment: false };
    if (lower === 'teleport'    || lower === 'suspense')                return { tag: 'div',  isFragment: false };

    // Native HTML tag
    if (HTML_TAGS.has(lower)) return { tag: lower, isFragment: false };

    // Custom component (PascalCase or kebab-case) → proxy as div
    return { tag: 'div', isFragment: false };
}

// -----------------------------------------------------------------------------
// Attribute Rendering
// -----------------------------------------------------------------------------

/**
 * Vue-specific attributes with no HTML meaning — always skipped.
 * @type {Set<string>}
 */
const SKIP_ATTRS = new Set(['key', 'ref', 'is']);

/**
 * Render Vue props (attributes + directives) to an HTML attribute string.
 *
 * Rules:
 *   Regular attributes (class, id, aria-*, role, alt, href, …) → kept as-is
 *   v-bind (:attr) → attr="dynamic" (or static value if literal string)
 *   v-on (@click) → skipped (event handlers irrelevant for a11y)
 *   v-if / v-else / v-for / v-show → skipped (structural)
 *   v-html / v-text → skipped (content directives)
 *   v-model → value="dynamic"
 *
 * @param {Array} props - Vue AST prop nodes
 * @returns {string}
 */
function renderAttributes(props) {
    const parts = [];

    for (const prop of props) {
        if (prop.type === NodeTypes.ATTRIBUTE) {
            if (SKIP_ATTRS.has(prop.name)) continue;
            if (prop.value) {
                parts.push(`${prop.name}="${escapeAttr(prop.value.content)}"`);
            } else {
                parts.push(prop.name); // boolean attribute
            }

        } else if (prop.type === NodeTypes.DIRECTIVE) {
            switch (prop.name) {
                case 'on':
                    break; // event handlers — skip

                case 'if':
                case 'else':
                case 'else-if':
                case 'for':
                case 'show':
                    break; // structural — skip

                case 'html':
                case 'text':
                    break; // content directives — skip

                case 'bind': {
                    // Skip dynamic attribute names: :[dynamicAttr]="val"
                    if (!prop.arg || !prop.arg.isStatic) break;
                    const attrName = prop.arg.content;
                    if (SKIP_ATTRS.has(attrName)) break;
                    const staticVal = tryExtractLiteralString(prop.exp?.content);
                    parts.push(`${attrName}="${escapeAttr(staticVal ?? 'dynamic')}"`);
                    break;
                }

                case 'model':
                    parts.push('value="dynamic"');
                    break;

                default:
                    break;
            }
        }
    }

    return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

/**
 * Attempt to extract a static string from a Vue expression.
 * Handles: 'literal', "literal", `literal`
 * Returns null for any compound expression (variable, ternary, etc.)
 *
 * @param {string|undefined} expr
 * @returns {string|null}
 */
function tryExtractLiteralString(expr) {
    if (!expr) return null;
    const m = expr.match(/^(['"`])([\s\S]*)\1$/);
    return m ? m[2] : null;
}

// wrapInDocument, escapeAttr, HTML_TAGS — imported from transformerUtils.js
