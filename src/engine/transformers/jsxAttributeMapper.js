/**
 * JSX Attribute Mapper
 *
 * Resolves JSX attribute nodes into HTML attribute strings.
 * Handles: className→class mapping, event handler filtering,
 * CSS Modules class resolution, style object serialization,
 * and static expression value extraction.
 *
 * @module engine/transformers/jsxAttributeMapper
 */

import * as t from '@babel/types';
import { escapeAttr } from './transformerUtils.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Render JSX attributes to an HTML attribute string.
 * Handles: className→class, htmlFor→for, event handlers (removed),
 * boolean attributes, dynamic values.
 *
 * @param {Array} attributes - JSX attribute nodes
 * @param {Map<string, string>} cssModuleBindings  localName → cssFilePath
 * @returns {string} - HTML attribute string
 */
export function renderAttributes(attributes, cssModuleBindings) {
    const attrParts = [];

    for (const attr of attributes) {
        if (t.isJSXSpreadAttribute(attr)) continue;

        const name = attr.name.name;
        const htmlAttr = mapAttributeName(name);

        if (isEventHandler(name)) continue;

        if (attr.value === null) {
            attrParts.push(htmlAttr);
            continue;
        }

        if (t.isStringLiteral(attr.value)) {
            attrParts.push(`${htmlAttr}="${escapeAttr(attr.value.value)}"`);
            continue;
        }

        // Style object: style={{ color: '#fff', backgroundColor: '#000' }}
        // Must be handled before the generic expression resolver,
        // because ObjectExpression → "dynamic" by default.
        if (htmlAttr === 'style' && t.isJSXExpressionContainer(attr.value)) {
            const cssString = resolveStyleObject(attr.value.expression);
            if (cssString) {
                attrParts.push(`style="${cssString}"`);
            }
            continue;
        }

        // CSS Modules: className={s.primary} or className={s['btn-error']}
        // Resolve member-access on a known CSS module identifier → literal class name.
        if (htmlAttr === 'class' && t.isJSXExpressionContainer(attr.value)) {
            const moduleClass = resolveCssModuleClass(attr.value.expression, cssModuleBindings);
            if (moduleClass !== null) {
                attrParts.push(`class="${escapeAttr(moduleClass)}"`);
                continue;
            }
        }

        // Expression value: alt={getAlt()}, src={imgUrl}
        if (t.isJSXExpressionContainer(attr.value)) {
            const resolved = resolveExpressionValue(attr.value.expression);
            if (resolved === null) continue;
            attrParts.push(`${htmlAttr}="${resolved}"`);
        }
    }

    return attrParts.length > 0 ? ' ' + attrParts.join(' ') : '';
}

// -----------------------------------------------------------------------------
// Attribute Name Mapping
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Expression Value Resolution
// -----------------------------------------------------------------------------

/**
 * Resolve a JSX expression value to a string for HTML output.
 *
 * @param {import('@babel/types').Expression} expression
 * @returns {string|null}
 */
function resolveExpressionValue(expression) {
    if (t.isStringLiteral(expression)) return escapeAttr(expression.value);
    if (t.isBooleanLiteral(expression) && !expression.value) return null;
    if (t.isBooleanLiteral(expression) && expression.value) return 'true';
    if (t.isNumericLiteral(expression)) return String(expression.value);
    return 'dynamic';
}

/**
 * Resolve a CSS Modules member-access expression to a literal class name.
 *
 * Handles:
 *   s.primary           → "primary"    (identifier property)
 *   styles['btn-error'] → "btn-error"  (string-literal computed property)
 *
 * Returns null if the expression is not a recognised CSS module access
 * (i.e. the object identifier is not in cssModuleBindings).
 *
 * @param {import('@babel/types').Expression} expression
 * @param {Map<string, string>} cssModuleBindings  localName → cssFilePath
 * @returns {string|null}
 */
function resolveCssModuleClass(expression, cssModuleBindings) {
    if (!t.isMemberExpression(expression)) return null;
    if (!t.isIdentifier(expression.object)) return null;
    if (!cssModuleBindings.has(expression.object.name)) return null;

    // s.primary  (non-computed)
    if (!expression.computed && t.isIdentifier(expression.property)) {
        return expression.property.name;
    }
    // s['btn-error']  (computed string literal)
    if (expression.computed && t.isStringLiteral(expression.property)) {
        return expression.property.value;
    }
    return null;
}

// -----------------------------------------------------------------------------
// Style Object Resolution
// -----------------------------------------------------------------------------

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

        const key = resolveStylePropertyKey(prop);
        if (!key) continue;

        const value = resolveStylePropertyValue(prop);
        if (!value) continue;

        declarations.push(`${camelToKebab(key)}: ${value}`);
    }

    return declarations.length > 0 ? declarations.join('; ') : null;
}

/**
 * Extract the CSS property key from a style object property node.
 * Returns null for computed keys or unrecognised node types.
 *
 * @param {import('@babel/types').ObjectProperty} prop
 * @returns {string|null}
 */
function resolveStylePropertyKey(prop) {
    if (t.isIdentifier(prop.key)) return prop.key.name;
    if (t.isStringLiteral(prop.key)) return prop.key.value;
    return null;
}

/**
 * Extract the CSS property value from a style object property node.
 * Only string and numeric literals are serializable statically.
 * Returns null for dynamic/unknown values.
 *
 * @param {import('@babel/types').ObjectProperty} prop
 * @returns {string|null}
 */
function resolveStylePropertyValue(prop) {
    if (t.isStringLiteral(prop.value)) return prop.value.value;
    if (t.isNumericLiteral(prop.value)) return String(prop.value.value);
    return null;
}

/**
 * Convert a camelCase CSS property name to kebab-case.
 * e.g. backgroundColor → background-color
 *
 * @param {string} key
 * @returns {string}
 */
function camelToKebab(key) {
    return key.replace(/([A-Z])/g, '-$1').toLowerCase();
}
