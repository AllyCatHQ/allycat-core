/**
 * Axe-Core Configuration
 *
 * Builds the axe-core tag list based on the selected accessibility standard.
 *
 * @module utils/axeConfig
 */

import { STANDARDS } from '../constants.js';

/**
 * Return the axe-core rule tags for the given config.
 *
 * @param {Object} config - User configuration
 * @param {string} config.selectedStandard - 'israel' | 'wcag-aa' | 'wcag-aaa'
 * @returns {string[]}
 */
export function getAxeTags(config) {
    const baseTags = ['best-practice'];
    const standardTagMap = {
        [STANDARDS.ISRAEL]:   ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        [STANDARDS.WCAG_AAA]: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
        [STANDARDS.WCAG_AA]:  ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
    };
    return [...baseTags, ...(standardTagMap[config.selectedStandard] || standardTagMap[STANDARDS.WCAG_AA])];
}
