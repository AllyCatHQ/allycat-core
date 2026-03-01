/**
 * Angular TypeScript Inline Template Extractor
 *
 * Detects Angular component files (.component.ts) that contain an inline
 * template (`template: \`...\``) and extracts the raw template string together
 * with its line offset within the source file.
 *
 * The extracted content is passed directly to transformAngularToHtml()
 * with the lineOffset so violations are mapped back to the correct line
 * numbers inside the .ts file.
 *
 * Files using `templateUrl:` are NOT handled here — the referenced .html
 * file is already discovered and scanned by the file resolver independently.
 *
 * @module engine/transformers/angularTsExtractor
 */

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Return true only when the TypeScript file is an Angular component that
 * contains an inline template string (backtick literal after `template:`).
 *
 * Files with `templateUrl:` return false — their .html is scanned separately.
 *
 * @param {string} sourceCode
 * @param {string} filePath
 * @returns {boolean}
 */
export function isAngularComponentTs(sourceCode, filePath) {
    if (!filePath.endsWith('.ts')) return false;
    if (!/@Component\s*\(/.test(sourceCode)) return false;
    return /\btemplate\s*:\s*`/.test(sourceCode);
}

/**
 * Extract the inline template string from an Angular @Component decorator.
 *
 * Returns the raw content between the backticks and the line offset so the
 * caller can map content-relative line numbers back to source file lines:
 *
 *   sourceLine = lineOffset + contentLineIndex(0-based) + 1
 *
 * Returns null if no extractable template is found (malformed / not a backtick
 * literal — dynamic expressions like `template: buildTemplate()` are skipped).
 *
 * @param {string} sourceCode
 * @returns {{ content: string, lineOffset: number } | null}
 */
export function extractInlineTemplate(sourceCode) {
    const templateKeyPos = sourceCode.search(/\btemplate\s*:\s*`/);
    if (templateKeyPos === -1) return null;

    const backtickPos = sourceCode.indexOf('`', templateKeyPos);
    if (backtickPos === -1) return null;

    // lineOffset = number of complete lines before (and including) the opening
    // backtick line, minus 1 so that content line 0 resolves to lineOffset + 1.
    //
    // Example — backtick on file line 3 (1-indexed):
    //   slice up to backtick+1 splits into 3 parts → length - 1 = 2
    //   content line 0 → 2 + 0 + 1 = 3  ✓  (same line as backtick)
    //   content line 1 → 2 + 1 + 1 = 4  ✓  (next line)
    const lineOffset = sourceCode.slice(0, backtickPos + 1).split('\n').length - 1;

    // Scan character-by-character for the closing backtick, respecting escapes.
    let i = backtickPos + 1;
    while (i < sourceCode.length) {
        if (sourceCode[i] === '\\') { i += 2; continue; } // skip \` or \\
        if (sourceCode[i] === '`') break;
        i++;
    }

    if (i >= sourceCode.length) return null; // unclosed template literal

    const content = sourceCode.slice(backtickPos + 1, i);
    return { content, lineOffset };
}
