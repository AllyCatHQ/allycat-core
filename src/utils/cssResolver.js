/**
 * CSS Resolver
 *
 * Resolves CSS imports from source files and injects them into HTML
 * as a <style> block so Playwright's browser engine can compute
 * accurate color values for contrast checking.
 *
 * Resolution strategy:
 *   1. Relative imports   — ./Button.css, ../theme/base.css
 *   2. Root aliases       — @styles/theme.css, @/assets/global.css
 *
 * Performance:
 *   A shared resolvedCache (Map<absolutePath, content>) is passed across
 *   all files in a single scan run. Each CSS file is read from disk
 *   exactly once regardless of how many components import it.
 *   Cache lookup is O(1).
 *
 * @module utils/cssResolver
 */

import fs from 'fs/promises';
import path from 'path';
import * as p from '@clack/prompts';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

/**
 * Regex patterns for CSS import detection.
 *
 * Matches:
 *   import './Button.css'
 *   import "../theme.css"
 *   import '@styles/global.css'
 *   import "@/assets/base.css"
 *
 * Does NOT match JS/TS module imports (no .css extension).
 */
const CSS_IMPORT_PATTERNS = [
    // ESM: import '...'  or  import "..."
    /import\s+['"]([^'"]+\.css)['"]/g,
    // require('...') 
    /require\s*\(\s*['"]([^'"]+\.css)['"]\s*\)/g,
];

/**
 * Extract CSS hrefs from HTML <link> tags.
 * Handles: <link rel="stylesheet" href="./styles.css">
 *
 * Used for HTML files — ESM import pattern does not apply.
 *
 * @param {string} sourceContent - Raw HTML file content
 * @returns {string[]} - Array of raw href values
 */
export function extractCssLinkHrefs(sourceContent) {
    const found = new Set();
    const pattern = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+\.css)["'][^>]*>/gi;
    // Also match href-before-rel order
    const patternAlt = /<link[^>]+href=["']([^"']+\.css)["'][^>]+rel=["']stylesheet["'][^>]*>/gi;

    for (const regex of [pattern, patternAlt]) {
        let match;
        while ((match = regex.exec(sourceContent)) !== null) {
            found.add(match[1]);
        }
    }

    return Array.from(found);
}

/**
 * Known root alias prefixes.
 * These are resolved relative to the project root (process.cwd()).
 *
 * Extend this list to support project-specific aliases (e.g. tsconfig paths).
 */
const ROOT_ALIAS_PREFIXES = ['@styles/', '@/', '@assets/', '@css/'];

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Extract all CSS import paths from a source file's content.
 *
 * Runs all import patterns against the source and deduplicates results.
 * Returns raw import strings exactly as written in source.
 *
 * @param {string} sourceContent - Raw file content (JSX, TSX, HTML)
 * @returns {string[]} - Array of raw import paths e.g. ['./Button.css', '@styles/theme.css']
 */
export function extractCssImports(sourceContent) {
    const found = new Set();

    for (const pattern of CSS_IMPORT_PATTERNS) {
        // Reset lastIndex — patterns are stateful when using /g flag
        pattern.lastIndex = 0;
        let match;
        while ((match = pattern.exec(sourceContent)) !== null) {
            found.add(match[1]);
        }
    }

    return Array.from(found);
}

/**
 * Resolve raw CSS import paths to absolute file paths.
 *
 * Handles:
 *   - Relative imports resolved from the importing file's directory
 *   - Root alias imports resolved from process.cwd()
 *
 * Unknown/unresolvable paths are returned as null and filtered out.
 *
 * @param {string[]} imports - Raw import paths from extractCssImports()
 * @param {string} sourceFilePath - Absolute path of the file containing the imports
 * @returns {string[]} - Array of resolved absolute paths
 */
export function resolveCssPaths(imports, sourceFilePath) {
    const sourceDir = path.dirname(sourceFilePath);
    const projectRoot = process.cwd();

    return imports
        .map(importPath => resolveOnePath(importPath, sourceDir, projectRoot))
        .filter(Boolean);
}

/**
 * Load CSS content for a list of absolute paths.
 *
 * Uses resolvedCache for memoization — files already read in this scan
 * run are returned immediately from cache without disk I/O.
 *
 * Files that cannot be read (missing, permission error) trigger a warning
 * and are skipped — scan continues normally.
 *
 * @param {string[]} absolutePaths - Resolved CSS file paths
 * @param {Map<string, string>} resolvedCache - Shared memoization cache for this scan run
 * @param {Set<string>} [_visited] - Internal cycle-guard set (do not pass — used by recursion)
 * @returns {Promise<string[]>} - Array of CSS file contents (missing files excluded)
 */
export async function loadCssFiles(absolutePaths, resolvedCache, _visited = new Set()) {
    const contents = [];

    for (const absolutePath of absolutePaths) {
        // Cycle guard — prevents infinite loops from circular @import chains
        if (_visited.has(absolutePath)) continue;
        _visited.add(absolutePath);

        const cached = resolvedCache.get(absolutePath);
        let content;

        if (cached !== undefined) {
            content = cached;
        } else {
            try {
                content = await fs.readFile(absolutePath, 'utf8');
                resolvedCache.set(absolutePath, content);
            } catch {
                p.log.warn(`CSS not found, skipping: ${path.relative(process.cwd(), absolutePath)}`);
                // Store empty string so we don't retry this path in the same run
                resolvedCache.set(absolutePath, '');
                continue;
            }
        }

        if (!content) continue;

        // Resolve @import directives inside this CSS file (transitive imports).
        // Nested content is prepended so cascade order is correct:
        // imported rules appear before the rules in the importing file.
        const transitivePaths = extractTransitiveCssImports(content, absolutePath);
        if (transitivePaths.length > 0) {
            const nested = await loadCssFiles(transitivePaths, resolvedCache, _visited);
            contents.push(...nested);
        }

        contents.push(content);
    }

    return contents.filter(c => c.length > 0);
}

/**
 * Inject a <style> block into the <head> of an HTML string.
 *
 * If cssContents is empty, returns html unchanged — no <style> tag added.
 * If <head> is present, injects before </head>.
 * If no <head>, prepends <style> at the top of the document.
 *
 * @param {string} html - Full HTML document string
 * @param {string[]} cssContents - Array of CSS file contents to inject
 * @returns {string} - HTML with injected <style> block
 */
export function injectCssIntoHtml(html, cssContents) {
    if (cssContents.length === 0) return html;

    const combined = cssContents.join('\n\n');
    const styleBlock = `<style>\n${combined}\n</style>`;

    if (html.includes('</head>')) {
        return html.replace('</head>', `${styleBlock}\n</head>`);
    }

    // Fallback: no <head> tag — prepend at top
    return `${styleBlock}\n${html}`;
}

/**
 * Full pipeline: extract → resolve → load → inject.
 *
 * Single entry point for full scanner use.
 * Mutates resolvedCache in place (memoization side effect).
 *
 * @param {string} html - Transformed HTML to inject into
 * @param {string} sourceContent - Raw source file content (for import extraction)
 * @param {string} sourceFilePath - Absolute path of the source file
 * @param {Map<string, string>} resolvedCache - Shared memoization cache
 * @param {string[]} [extraCssStrings=[]] - Already-resolved CSS strings to inject
 *   directly (e.g. Vue <style> block contents, Angular inline styles[]).
 *   These bypass the file-load pipeline and go straight to injectCssIntoHtml.
 * @returns {Promise<string>} - HTML with CSS injected
 */
export async function resolvAndInjectCss(html, sourceContent, sourceFilePath, resolvedCache, extraCssStrings = []) {
    const isHtml = sourceFilePath.endsWith('.html');

    // HTML files use <link href=""> — JSX/TSX/Vue use import statements
    const rawImports = isHtml
        ? extractCssLinkHrefs(sourceContent)
        : extractCssImports(sourceContent);

    const absolutePaths = rawImports.length > 0
        ? resolveCssPaths(rawImports, sourceFilePath)
        : [];

    const fileContents = absolutePaths.length > 0
        ? await loadCssFiles(absolutePaths, resolvedCache)
        : [];

    const allCss = [...fileContents, ...extraCssStrings];
    if (allCss.length === 0) return html;

    return injectCssIntoHtml(html, allCss);
}

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

/**
 * Resolve a single import path to an absolute file path.
 *
 * @param {string} importPath - Raw import string
 * @param {string} sourceDir - Directory of the importing file
 * @param {string} projectRoot - process.cwd()
 * @returns {string|null} - Absolute path or null if unresolvable
 */
function resolveOnePath(importPath, sourceDir, projectRoot) {
    // Relative import: starts with ./ or ../
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
        return path.resolve(sourceDir, importPath);
    }

    // Root alias import: @styles/..., @/..., etc.
    const matchedAlias = ROOT_ALIAS_PREFIXES.find(prefix => importPath.startsWith(prefix));
    if (matchedAlias) {
        // Strip alias prefix and resolve from project root
        const stripped = importPath.slice(matchedAlias.length);
        // Map @/ → src/, @styles/ → src/styles/, etc.
        const aliasToDir = resolveAliasDir(matchedAlias, projectRoot);
        return path.resolve(aliasToDir, stripped);
    }

    // Unrecognized format (e.g. bare module: 'normalize.css')
    // These would require node_modules resolution — out of current scope
    return null;
}

/**
 * Map a root alias prefix to its resolved base directory.
 *
 * Conventions:
 *   @/        → <root>/src/
 *   @styles/  → <root>/src/styles/
 *   @assets/  → <root>/src/assets/
 *   @css/     → <root>/src/css/
 *
 * @param {string} alias - Alias prefix including trailing slash
 * @param {string} projectRoot
 * @returns {string} - Absolute base directory for this alias
 */
function resolveAliasDir(alias, projectRoot) {
    const srcRoot = path.join(projectRoot, 'src');

    const aliasMap = {
        '@/': srcRoot,
        '@styles/': path.join(srcRoot, 'styles'),
        '@assets/': path.join(srcRoot, 'assets'),
        '@css/': path.join(srcRoot, 'css'),
    };

    return aliasMap[alias] ?? srcRoot;
}

/**
 * Extract absolute paths from @import directives inside a CSS file.
 *
 * Only resolves relative imports (./  or  ../).
 * Bare module imports (e.g. @import 'normalize.css') are skipped —
 * those require node_modules resolution handled separately in Feature 6.
 *
 * @param {string} cssContent - Contents of an already-loaded CSS file
 * @param {string} cssFilePath - Absolute path of that CSS file (used as resolution base)
 * @returns {string[]} - Absolute paths of transitively imported CSS files
 */
function extractTransitiveCssImports(cssContent, cssFilePath) {
    const cssDir = path.dirname(cssFilePath);
    // Matches: @import './file.css'  @import "../file.css"
    const pattern = /@import\s+['"]([^'"]+\.css)['"]/g;
    const paths = [];
    let match;
    while ((match = pattern.exec(cssContent)) !== null) {
        const raw = match[1];
        if (raw.startsWith('./') || raw.startsWith('../')) {
            paths.push(path.resolve(cssDir, raw));
        }
    }
    return paths;
}
