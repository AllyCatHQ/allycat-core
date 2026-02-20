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
 * @returns {Promise<string[]>} - Array of CSS file contents (in same order, missing files excluded)
 */
export async function loadCssFiles(absolutePaths, resolvedCache) {
    const contents = [];

    for (const absolutePath of absolutePaths) {
        const cached = resolvedCache.get(absolutePath);

        if (cached !== undefined) {
            contents.push(cached);
            continue;
        }

        try {
            const content = await fs.readFile(absolutePath, 'utf8');
            resolvedCache.set(absolutePath, content);
            contents.push(content);
        } catch {
            p.log.warn(`CSS not found, skipping: ${path.relative(process.cwd(), absolutePath)}`);
            // Store empty string so we don't retry this path in the same run
            resolvedCache.set(absolutePath, '');
        }
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
 * @returns {Promise<string>} - HTML with CSS injected
 */
export async function resolvAndInjectCss(html, sourceContent, sourceFilePath, resolvedCache) {
    const rawImports = extractCssImports(sourceContent);
    if (rawImports.length === 0) return html;

    const absolutePaths = resolveCssPaths(rawImports, sourceFilePath);
    if (absolutePaths.length === 0) return html;

    const cssContents = await loadCssFiles(absolutePaths, resolvedCache);
    return injectCssIntoHtml(html, cssContents);
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
