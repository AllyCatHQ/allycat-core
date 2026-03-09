/**
 * Shared scanner utilities
 *
 * Functions used by both quickScanner and fullScanner that do not belong
 * to any single transformer or violation-processing module.
 */

import { isJsxFile } from '../transformers/jsxTransformer.js';
import { isVueFile } from '../transformers/vueTransformer.js';
import { isAngularTemplate } from '../transformers/angularTransformer.js';
import { isAngularComponentTs } from '../transformers/angularTsExtractor.js';

/**
 * Classify the file type for a given source file.
 *
 * Evaluated in priority order: JSX → Vue → Angular HTML → Angular TS → plain HTML.
 * Returns boolean flags plus a convenience `isComponent` flag that is true for
 * any non-plain-HTML file that requires a transformer step.
 *
 * @param {string} filePath
 * @param {string} sourceContent
 * @returns {{ isJsx: boolean, isVue: boolean, isAngularHtml: boolean, isAngularTs: boolean, isComponent: boolean }}
 */
export function detectFileContext(filePath, sourceContent) {
    const isJsx         = isJsxFile(filePath);
    const isVue         = !isJsx && isVueFile(filePath);
    const isAngularHtml = !isJsx && !isVue && isAngularTemplate(sourceContent, filePath);
    const isAngularTs   = !isJsx && !isVue && !isAngularHtml && isAngularComponentTs(sourceContent, filePath);
    const isComponent   = isJsx || isVue || isAngularHtml || isAngularTs;
    return { isJsx, isVue, isAngularHtml, isAngularTs, isComponent };
}
