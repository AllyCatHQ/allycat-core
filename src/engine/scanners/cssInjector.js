/**
 * CSS Injector — Framework-specific CSS resolution and injection
 *
 * Resolves extra CSS (Vue <style> blocks, Angular styleUrls, CSS Modules)
 * and prepares it for Playwright contrast checking.
 */

import path from 'path';
import { extractStyleBlocks } from '../transformers/vueTransformer.js';
import { extractStyleUrls, extractInlineStyles } from '../transformers/angularTsExtractor.js';
import { resolveCssPaths, loadCssFiles } from '../../utils/cssResolver.js';

/**
 * Build the extra CSS array for a given file.
 *
 * "Extra CSS" is framework-specific CSS that lives outside the normal
 * import/link pipeline (e.g. Vue <style> blocks, Angular styleUrls, CSS Modules).
 * It is passed directly to resolvAndInjectCss so Playwright can compute
 * accurate contrast values.
 *
 * @param {string} filePath
 * @param {string} sourceContent
 * @param {{ isVue: boolean, isAngularTs: boolean, isAngularHtml: boolean }} fileContext
 * @param {Map<string,string>} cssModuleBindings
 * @param {Map<string,string>} cssCache
 * @param {Map<string,string>} aliases
 * @returns {Promise<string[]>}
 */
export async function buildExtraCss(filePath, sourceContent, { isVue, isAngularTs, isAngularHtml }, cssModuleBindings, cssCache, aliases) {
    let extraCss = [];
    if (isVue) {
        // Vue SFC: extract <style>, <style scoped>, <style module> block contents
        extraCss = extractStyleBlocks(sourceContent);
    } else if (isAngularTs) {
        // Angular component: load styleUrls files + collect inline styles[] strings
        const rawUrls = extractStyleUrls(sourceContent);
        if (rawUrls.length > 0) {
            const resolvedPaths = resolveCssPaths(rawUrls, path.resolve(filePath));
            extraCss.push(...await loadCssFiles(resolvedPaths, cssCache));
        }
        extraCss.push(...extractInlineStyles(sourceContent));
        // CSS Module imports: import styles from './comp.module.css'
        if (cssModuleBindings.size > 0) {
            const modulePaths = resolveCssPaths([...cssModuleBindings.values()], path.resolve(filePath), aliases);
            extraCss.push(...await loadCssFiles(modulePaths, cssCache));
        }
    } else if (isAngularHtml && cssModuleBindings.size > 0) {
        // CSS module files detected in companion .ts — load for contrast checking
        const modulePaths = resolveCssPaths([...cssModuleBindings.values()], path.resolve(filePath), aliases);
        extraCss.push(...await loadCssFiles(modulePaths, cssCache));
    }
    return extraCss;
}
