/**
 * Angular Transformer
 *
 * Converts Angular component templates into scannable HTML via two passes:
 *   Pass 1 — strip Angular 17+ control flow lines (@if, @for, @switch, @defer, …)
 *   Pass 2 — transform Angular HTML syntax line by line:
 *              • binding attributes  → HTML equivalents or removed
 *              • Angular elements    → HTML equivalents
 *              • custom components   → <div data-component="PascalName">
 *
 * Preserves source line numbers via lineMap for accurate violation reporting.
 * No external Angular compiler required — regex-based processing is sufficient
 * because Angular templates are HTML files with predictable decoration layered on top.
 *
 * @module engine/transformers/angularTransformer
 */

import { wrapInDocument, HTML_TAGS, HTML_WRAPPER_OFFSET, registerOrdinalEntry } from './transformerUtils.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

// HTML_WRAPPER_OFFSET — re-exported from transformerUtils for backward compatibility
export { HTML_WRAPPER_OFFSET };

/**
 * Detect whether a file is an Angular component template.
 *
 * Primary:  .component.html filename convention (definitive).
 * Fallback: content heuristics — any one Angular-specific pattern suffices.
 *
 * @param {string} sourceCode
 * @param {string} filePath
 * @returns {boolean}
 */
export function isAngularTemplate(sourceCode, filePath) {
    if (/\.component\.html$/.test(filePath)) return true;

    const STRONG_SIGNALS = [
        /\*ng(?:If|For|Switch|While|Class|Style)\s*=/i,
        /\[\(ng\w+\)\]/,
        /<(?:ng-container|ng-template|ng-content|router-outlet)\b/,
        /\[attr\.\w/,
    ];
    return STRONG_SIGNALS.some(pattern => pattern.test(sourceCode));
}

/**
 * Transform an Angular template into scannable HTML.
 *
 * @param {string} sourceCode       - Raw Angular template content
 * @param {number} lineOffset       - Source lines before this content begins (0 for .html files,
 *                                    N for inline templates extracted from .component.ts).
 *                                    Content line i (0-indexed) maps to source line lineOffset + i + 1.
 * @param {Map<string,string>} cssModuleBindings - Map<localName, cssPath> from extractCssModuleImports().
 *                                    Used to resolve [class]="styles.prop" → class="prop".
 *                                    Pass an empty Map (default) when CSS Modules are not in use.
 * @returns {{ html: string, lineMap: Map<number, number>, ordinalIndex: Map<string, number[]> }}
 */
export function transformAngularToHtml(sourceCode, lineOffset = 0, cssModuleBindings = new Map()) {
    const sourceLines = sourceCode.split('\n');

    // Pass 1: drop control flow lines, preserve (content, sourceLine) pairs
    const pass1 = [];
    for (let i = 0; i < sourceLines.length; i++) {
        if (!isControlFlowLine(sourceLines[i].trim())) {
            pass1.push({ content: sourceLines[i], sourceLine: lineOffset + i + 1 });
        }
    }

    // Pass 2: transform Angular syntax, build lineMap + ordinalIndex
    const htmlLines   = [];
    const lineMap     = new Map();
    const ordinalIndex = new Map();

    for (const { content, sourceLine } of pass1) {
        const transformed = transformLine(content, cssModuleBindings);
        htmlLines.push(transformed);

        const htmlLineNum = htmlLines.length; // 1-indexed
        const tagMatch = transformed.match(/^\s*<([a-zA-Z][a-zA-Z0-9-]*)/);
        if (tagMatch) {
            const tag = tagMatch[1].toLowerCase();
            lineMap.set(htmlLineNum, sourceLine);
            registerOrdinalEntry(ordinalIndex, tag, sourceLine);
        }
    }

    return {
        html: wrapInDocument(htmlLines.join('\n')),
        lineMap,
        ordinalIndex,
    };
}

// -----------------------------------------------------------------------------
// Pass 1 — Control flow detection (Angular 17+)
// -----------------------------------------------------------------------------

/**
 * Returns true for lines that are Angular 17+ control flow syntax.
 * These lines carry no HTML content and must be stripped before HTML parsing.
 *
 * Patterns removed:
 *   @if / @else if / @else / @for / @switch / @case / @default
 *   @defer / @placeholder / @loading / @error / @empty
 *   @let name = expr;
 *   }            ← standalone closing brace (block close)
 *   } @else {    ← close + reopen
 *
 * @param {string} trimmed - Already-trimmed source line
 * @returns {boolean}
 */
function isControlFlowLine(trimmed) {
    if (!trimmed) return false;
    if (trimmed.startsWith('@')) return true;   // any @keyword line
    if (/^\}\s*$/.test(trimmed)) return true;   // standalone }
    if (/^\}\s*@/.test(trimmed)) return true;   // } @else, } @empty, etc.
    return false;
}

// -----------------------------------------------------------------------------
// Pass 2 — Line transformation
// -----------------------------------------------------------------------------

/**
 * Angular built-in elements and their HTML structural equivalents.
 * All render as invisible containers or routing placeholders at runtime.
 *
 * @type {Map<string, string>}
 */
const ANGULAR_ELEMENT_MAP = new Map([
    ['ng-container', 'div'],
    ['ng-template',  'div'],
    ['ng-content',   'div'],
    ['ng-if',        'div'],
    ['router-outlet','div'],
]);

/**
 * Transform a single line of Angular HTML.
 *
 * Order of operations:
 *   1. Angular built-in element open/close  → HTML equivalents
 *   2. Custom component open tags           → <div data-component="PascalName">
 *   3. Custom component close tags          → </div>
 *   4. Angular binding/directive attributes → cleaned or removed
 *
 * @param {string} line
 * @param {Map<string,string>} cssModuleBindings
 * @returns {string}
 */
function transformLine(line, cssModuleBindings) {
    let result = line;

    // 1. Angular built-in elements
    for (const [ngTag, htmlTag] of ANGULAR_ELEMENT_MAP) {
        result = result.replace(new RegExp(`<${ngTag}\\b`, 'gi'), `<${htmlTag}`);
        result = result.replace(new RegExp(`</${ngTag}>`, 'gi'), `</${htmlTag}>`);
    }

    // 2. Custom component open tags (any kebab-case element not in HTML spec)
    //    Negative lookahead on / prevents matching closing tags.
    //    HTML elements never contain hyphens — custom elements always do.
    result = result.replace(
        /<(?!\/)([a-z][a-z0-9]*(?:-[a-z0-9]+)+)\b/g,
        (_m, tag) => `<div data-component="${toComponentName(tag)}"`,
    );

    // 3. Custom component close tags
    result = result.replace(/<\/([a-z][a-z0-9]*(?:-[a-z0-9]+)+)>/g, '</div>');

    // 4. Angular attribute syntax
    result = cleanAngularAttributes(result, cssModuleBindings);

    return result;
}

/**
 * Convert a kebab-case Angular selector to PascalCase component name.
 *
 * @param {string} selector - e.g. "app-user-profile"
 * @returns {string}        - e.g. "AppUserProfile"
 */
function toComponentName(selector) {
    return selector.split('-').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

// -----------------------------------------------------------------------------
// Attribute cleaning
// -----------------------------------------------------------------------------

/**
 * Strip / transform Angular binding syntax within a line.
 *
 * Applied in strict order to prevent regex conflicts:
 *
 *   Two-way binding    [(ngModel)]="var"        → value="dynamic"
 *   Attribute binding  [attr.aria-label]="x"    → aria-label="dynamic"
 *   Class binding      [class.active]="bool"     → removed
 *   Style binding      [style.color]="expr"      → removed
 *   Property binding   [disabled]="expr"         → disabled="dynamic"
 *   Event binding      (click)="fn()"            → removed
 *   Structural dir.    *ngIf="..." *ngFor="..."  → removed
 *   Template variable  #myRef #myRef="dir"       → removed
 *
 * Regular HTML attributes (class, id, aria-*, role, href, alt, …) are untouched.
 *
 * @param {string} line
 * @param {Map<string,string>} cssModuleBindings
 * @returns {string}
 */
function cleanAngularAttributes(line, cssModuleBindings = new Map()) {
    let r = line;

    // CSS module class resolution — must run before generic [ngClass] removal and
    // the generic property binding that would produce class="dynamic".
    //   [class]="styles.container"    → class="container"
    //   [ngClass]="styles.container"  → class="container"
    //   [class]="styles['btn-error']" → class="btn-error"
    if (cssModuleBindings.size > 0) {
        const names = [...cssModuleBindings.keys()].join('|');
        r = r
            .replace(
                new RegExp(`\\[(?:class|ngClass)\\]="(${names})\\.([\\w-]+)"`, 'g'),
                (_m, _obj, prop) => `class="${prop}"`,
            )
            .replace(
                new RegExp(`\\[(?:class|ngClass)\\]="(${names})\\['([^']+)'\\]"`, 'g'),
                (_m, _obj, prop) => `class="${prop}"`,
            );
    }

    // Two-way binding — most specific, must come first
    r = r.replace(/\[\(ng\w+\)\]\s*=\s*"[^"]*"/g, 'value="dynamic"');

    // Attribute binding: [attr.aria-label]="..." → aria-label="dynamic"
    r = r.replace(/\[attr\.([\w-]+)\]\s*=\s*"[^"]*"/g, '$1="dynamic"');

    // Class / style / Angular directive bindings — no HTML output, remove
    // Covers: [class.foo], [style.color], [ngClass], [ngStyle], [ngSwitch], [cdkVirtualFor], etc.
    r = r.replace(/\[class\.[\w-]+\]\s*=\s*"[^"]*"/g, '');
    r = r.replace(/\[style\.[\w-]+\]\s*=\s*"[^"]*"/g, '');
    r = r.replace(/\[ng(?:Class|Style|Switch|If|For|Model)\]\s*=\s*"[^"]*"/gi, '');
    r = r.replace(/\[cdk[\w]+\]\s*=\s*"[^"]*"/gi, '');

    // Generic property binding: [disabled]="expr" → disabled="dynamic"
    r = r.replace(/\[([\w][\w-]*)\]\s*=\s*"[^"]*"/g, '$1="dynamic"');

    // Event bindings: (click)="fn()", (keydown.enter)="fn()", (document:click)="fn()"
    r = r.replace(/\([\w.$:-]+\)\s*=\s*"[^"]*"/g, '');

    // Structural directives: *ngIf="...", *ngFor="...", *ngSwitchDefault
    r = r.replace(/\*ng\w+(?:\s*=\s*"[^"]*")?/gi, '');

    // Template reference variables: #myRef, #myRef="directive"
    r = r.replace(/#\w+(?:\s*=\s*"[^"]*")?/g, '');

    return r;
}
