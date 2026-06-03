/**
 * RTL Runner — Playwright-based RTL compliance checking
 *
 * Checks whether a page declares RTL text direction,
 * and produces a structured violation if it does not.
 */

import { createRtlViolation, RTL_LANG_PREFIXES, isRtlLanguage } from '../violations/rtlValidator.js';
import { findLineNumber } from '../../utils/sourceMapper.js';

/**
 * Check RTL compliance using Playwright page
 *
 * @param {Object} page - Playwright page object
 * @param {string} filePath - Source file path
 * @param {string} sourceContent - Original source code
 * @param {boolean} isComponent - True for JSX/Vue/Angular files (checks body root, not <html>)
 * @param {Map<string,number[]>|null} ordinalIndex - Tag→line map for component root lookup
 * @returns {Promise<Object|null>} - RTL violation object or null
 */
export async function checkRtlCompliancePlaywright(page, filePath, sourceContent, isComponent, ordinalIndex) {
    if (isComponent) {
        // Step 1: dir="rtl" declared anywhere → compliant
        const hasRtl = await page.evaluate(() => !!document.querySelector('[dir="rtl"]'));
        if (hasRtl) return null;

        // Step 2: No RTL lang attribute anywhere → no RTL obligation in this component
        const hasRtlLang = await page.evaluate((prefixes) => {
            const selector = prefixes.map(l => `[lang^="${l}"]`).join(',');
            return !!document.querySelector(selector);
        }, RTL_LANG_PREFIXES);
        if (!hasRtlLang) return null;

        // Step 3: RTL language present but no dir declaration → genuine violation
        const rootInfo = await page.evaluate(() => {
            const root = document.body?.firstElementChild;
            return root
                ? { tag: root.tagName.toLowerCase(), html: root.outerHTML.split('>')[0] + '>' }
                : { tag: 'div', html: '<div>' };
        });

        const sourceLines = ordinalIndex?.get(rootInfo.tag);
        const lineNumber = (sourceLines && sourceLines.length > 0)
            ? sourceLines[0]
            : findLineNumber(sourceContent, `<${rootInfo.tag}`);

        const helpText = 'Add dir="rtl" to your root element to support RTL languages (Hebrew, Arabic, Persian).';

        return createRtlViolation(filePath, rootInfo.html, lineNumber, rootInfo.tag, helpText);
    }

    // Plain HTML file — apply 3-step algorithm
    // Step 1: dir="rtl" declared anywhere → compliant
    const hasRtlAnywhere = await page.evaluate(() => !!document.querySelector('[dir="rtl"]'));
    if (hasRtlAnywhere) return null;

    // Step 2: Page language is not RTL → no obligation
    const htmlLang = await page.evaluate(() => document.documentElement?.getAttribute('lang') ?? '');
    if (!isRtlLanguage(htmlLang)) return null;

    // Step 3: RTL-primary page with no dir declarations → genuine violation
    return createRtlViolation(
        filePath,
        '<html>',
        findLineNumber(sourceContent, '<html')
    );
}
