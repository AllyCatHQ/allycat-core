/**
 * JSX Transformer
 *
 * Entry point for JSX/TSX → HTML conversion.
 * Coordinates parsing, AST traversal, and rendering via sub-modules.
 *
 * Responsibilities:
 *  - Parse JSX/TSX source with Babel
 *  - Collect root JSX nodes from the AST
 *  - Extract CSS Modules import bindings
 *  - Delegate rendering to jsxRenderer
 *  - Return HTML string + lineMap + ordinalIndex
 *
 * @module engine/transformers/jsxTransformer
 */

import { parse } from '@babel/parser';
import _traverse from '@babel/traverse';
const traverse = _traverse.default ?? _traverse;
import * as t from '@babel/types';
import { wrapInDocument } from './transformerUtils.js';
import { renderNodesToHtml } from './jsxRenderer.js';

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
    const cssModuleBindings = extractCssModuleBindings(ast);
    const jsxNodes = collectJsxRoots(ast);
    const { html, lineMap, ordinalIndex } = renderNodesToHtml(jsxNodes, cssModuleBindings);

    return { html: wrapInDocument(html), lineMap, ordinalIndex };
}

/**
 * Check whether a file path is a JSX or TSX file.
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
 * Matches the structure of wrapInDocument() — count the lines
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
// AST Traversal
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

/**
 * Walk the AST and collect CSS Modules default-import bindings.
 *
 * Returns a Map of localIdentifier → cssFilePath for any import of the form:
 *   import s from './Button.module.css'
 *
 * Used by renderAttributes() to resolve className={s.primary} → class="primary".
 *
 * @param {import('@babel/types').File} ast
 * @returns {Map<string, string>}  e.g. Map { 's' => './Button.module.css' }
 */
function extractCssModuleBindings(ast) {
    const bindings = new Map();
    traverse(ast, {
        ImportDeclaration(nodePath) {
            const src = nodePath.node.source.value;
            if (!src.endsWith('.css')) return;
            for (const specifier of nodePath.node.specifiers) {
                if (t.isImportDefaultSpecifier(specifier)) {
                    bindings.set(specifier.local.name, src);
                }
            }
        },
    });
    return bindings;
}
