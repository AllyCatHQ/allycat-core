/**
 * RTL Runner — Playwright-based RTL compliance checking
 *
 * Checks whether a page declares RTL text direction,
 * and produces a structured violation if it does not.
 */

import { STANDARDS } from '../../constants.js';
import { createRtlViolation } from '../violations/rtlValidator.js';
import { findLineNumber } from '../../utils/sourceMapper.js';

/**
 * Check RTL compliance using Playwright page
 *
 * @param {Object} page - Playwright page object
 * @param {string} filePath - Source file path
 * @param {string} sourceContent - Original source code
 * @param {boolean} isComponent - True for JSX/Vue/Angular files (checks body root, not <html>)
 * @param {Map<string,number[]>|null} ordinalIndex - Tag→line map for component root lookup
 * @param {string} selectedStandard - Accessibility standard (e.g. STANDARDS.ISRAEL)
 * @returns {Promise<Object|null>} - RTL violation object or null
 */
export async function checkRtlCompliancePlaywright(page, filePath, sourceContent, isComponent, ordinalIndex, selectedStandard) {
    if (isComponent) {
        const hasRtl = await page.evaluate(() => !!document.querySelector('[dir="rtl"]'));
        if (hasRtl) return null;

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

        const helpText = selectedStandard === STANDARDS.ISRAEL
            ? 'Add dir="rtl" to your root element or to the <html> tag in index.html.'
            : 'Add dir="rtl" to your root element to support RTL languages (Hebrew, Arabic, Persian).';

        return createRtlViolation(selectedStandard, filePath, rootInfo.html, lineNumber, rootInfo.tag, helpText);
    }

    // Plain HTML file — check <html> element directly
    const hasRtl = await page.evaluate(() => document.documentElement.getAttribute('dir') === 'rtl');
    if (hasRtl) return null;

    return createRtlViolation(
        selectedStandard,
        filePath,
        '<html>',
        findLineNumber(sourceContent, '<html')
    );
}
