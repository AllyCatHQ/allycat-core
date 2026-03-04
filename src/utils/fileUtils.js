import fs from 'fs/promises';

/**
 * Reads a source file with BOM detection.
 *
 * Handles:
 *   UTF-16 LE  (FF FE) — Windows tools, legacy CMS exports
 *   UTF-16 BE  (FE FF) — rare but valid
 *   UTF-8 BOM  (EF BB BF) — Visual Studio, some corporate tools
 *   UTF-8      (default) — all modern editors
 *
 * Falls through to UTF-8 when no BOM is present, so normal files are unaffected.
 *
 * @param {string} filePath - Absolute or relative path to the file
 * @returns {Promise<string>} - Decoded file content as a UTF-8 string
 */
export async function readSourceFile(filePath) {
    const buf = await fs.readFile(filePath);

    if (buf[0] === 0xFF && buf[1] === 0xFE)
        return buf.toString('utf16le');

    if (buf[0] === 0xFE && buf[1] === 0xFF)
        return buf.swap16().toString('utf16le');

    if (buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF)
        return buf.slice(3).toString('utf8');

    return buf.toString('utf8');
}