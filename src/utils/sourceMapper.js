/**
 * Source Mapper Utility
 * 
 * Maps DOM elements back to approximate source line numbers.
 * Uses pattern matching since DOM parsing loses line information.
 * 
 * @module utils/sourceMapper
 */

/**
 * Find approximate line number for an HTML snippet in source code
 * 
 * @param {string} sourceCode - Original HTML source
 * @param {string} htmlSnippet - HTML snippet from axe-core (e.g., '<img src="logo.png">')
 * @returns {number|null} - Line number (1-indexed) or null if not found
 */
export function findLineNumber(sourceCode, htmlSnippet) {
    if (!sourceCode || !htmlSnippet) return null;

    // Clean the snippet for matching
    const cleanSnippet = normalizeHtml(htmlSnippet);
    
    // Try exact match first
    const exactLine = findExactMatch(sourceCode, cleanSnippet);
    if (exactLine) return exactLine;

    // Try tag + attributes match (handles whitespace differences)
    const tagMatch = findTagMatch(sourceCode, htmlSnippet);
    if (tagMatch) return tagMatch;

    return null;
}

/**
 * Normalize HTML for comparison (collapse whitespace, lowercase tags)
 */
function normalizeHtml(html) {
    return html
        .replace(/\s+/g, ' ')           // Collapse whitespace
        .replace(/>\s+</g, '><')         // Remove space between tags
        .trim();
}

/**
 * Find exact match in source code
 */
function findExactMatch(source, snippet) {
    const lines = source.split('\n');
    
    // First: try single-line match
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(snippet)) {
            return i + 1; // 1-indexed
        }
    }
    
    // Second: try normalized single-line match
    const normalizedSnippet = normalizeHtml(snippet);
    for (let i = 0; i < lines.length; i++) {
        if (normalizeHtml(lines[i]).includes(normalizedSnippet)) {
            return i + 1;
        }
    }

    // Third: handle multi-line elements
    // Find by unique attribute (href, id, class) in the snippet
    const uniqueAttr = extractUniqueAttribute(snippet);
    if (uniqueAttr) {
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(uniqueAttr)) {
                return i + 1;
            }
        }
    }
    
    return null;
}

/**
 * Extract a unique attribute value from HTML snippet for matching
 * Prioritizes: href, id, src, then first class
 */
function extractUniqueAttribute(html) {
    // Try href first (very unique)
    const hrefMatch = html.match(/href\s*=\s*["']([^"']+)["']/);
    if (hrefMatch) return hrefMatch[1];

    // Try id
    const idMatch = html.match(/id\s*=\s*["']([^"']+)["']/);
    if (idMatch) return idMatch[1];

    // Try src
    const srcMatch = html.match(/src\s*=\s*["']([^"']+)["']/);
    if (srcMatch) return srcMatch[1];

    return null;
}
/**
 * Find tag with matching attributes (more flexible matching)
 */
function findTagMatch(source, htmlSnippet) {
    // Extract tag name and key attributes from snippet
    const tagInfo = parseTagInfo(htmlSnippet);
    if (!tagInfo) return null;

    const lines = source.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Check if line contains the tag
        if (!line.toLowerCase().includes(`<${tagInfo.tagName.toLowerCase()}`)) {
            continue;
        }
        
        // Check for matching attributes
        let allAttributesMatch = true;
        for (const [attr, value] of Object.entries(tagInfo.attributes)) {
            // Match attribute with value or just attribute name
            const attrPattern = value 
                ? new RegExp(`${attr}\\s*=\\s*["']${escapeRegex(value)}["']`, 'i')
                : new RegExp(`${attr}(?:\\s*=|\\s|>)`, 'i');
            
            if (!attrPattern.test(line)) {
                allAttributesMatch = false;
                break;
            }
        }
        
        if (allAttributesMatch && Object.keys(tagInfo.attributes).length > 0) {
            return i + 1;
        }
        
        // If no attributes to match, just return first tag occurrence
        if (Object.keys(tagInfo.attributes).length === 0) {
            return i + 1;
        }
    }
    
    return null;
}

/**
 * Parse tag name and attributes from HTML snippet
 */
function parseTagInfo(html) {
    // Match opening tag: <tagName attr1="value1" attr2="value2" ...>
    const tagMatch = html.match(/<(\w+)([^>]*)>/);
    if (!tagMatch) return null;

    const tagName = tagMatch[1];
    const attributeString = tagMatch[2];
    
    // Parse attributes
    const attributes = {};
    const attrRegex = /(\w+)(?:\s*=\s*["']([^"']*)["'])?/g;
    let match;
    
    while ((match = attrRegex.exec(attributeString)) !== null) {
        const [, name, value] = match;
        if (name && name !== tagName) {
            attributes[name.toLowerCase()] = value || '';
        }
    }
    
    return { tagName, attributes };
}

/**
 * Escape special regex characters
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build an ordinal index from raw HTML source: tagName → [line1, line2, ...].
 *
 * Mirrors the ordinalIndex produced by JSX/Vue/Angular transformers so the
 * same Layer A resolver (resolveViaOrdinalIndex) works for plain HTML files.
 * Without this, multiple identical elements (e.g. four bare <button></button>)
 * all resolve to the first occurrence in the file.
 *
 * @param {string} sourceContent - Raw HTML source
 * @returns {Map<string, number[]>}
 */
export function buildHtmlOrdinalIndex(sourceContent) {
    const index = new Map();
    const lines = sourceContent.split('\n');
    // Match opening tags only — skip </tag>, <!--, <!DOCTYPE
    const openTagRe = /<(?!\/)([a-zA-Z][a-zA-Z0-9]*)/g;

    for (let i = 0; i < lines.length; i++) {
        openTagRe.lastIndex = 0;
        let match;
        while ((match = openTagRe.exec(lines[i])) !== null) {
            const tag = match[1].toLowerCase();
            if (!index.has(tag)) index.set(tag, []);
            index.get(tag).push(i + 1); // 1-indexed line number
        }
    }

    return index;
}

/**
 * Extract the raw source line at a given line number.
 *
 * @param {string} sourceContent - Original file source
 * @param {number} lineNumber - 1-indexed line number where the element starts
 * @returns {string|null} - Trimmed source line or null
 */
export function extractSourceLine(sourceContent, lineNumber) {
    if (!sourceContent || !lineNumber || lineNumber < 1) return null;
    const lines = sourceContent.split('\n');
    if (lineNumber > lines.length) return null;

    const line = lines[lineNumber - 1]?.trim();
    if (!line) return null;

    if (line.endsWith('>') && !line.includes('/>') && !line.includes('</')) {
        for (let i = lineNumber; i < Math.min(lines.length, lineNumber + 3); i++) {
            const nextLine = lines[i]?.trim();
            if (nextLine) return `${line}  ${nextLine}...`;
        }
    }
    return line;
}

/**
 * Extract meaningful identifier from CSS selector
 * Simplifies axe-core's verbose selectors for display
 * 
 * @param {string} selector - CSS selector from axe-core
 * @returns {string} - Simplified selector
 */
export function simplifySelector(selector) {
    if (!selector) return '';
    
    // If selector is an array (axe-core returns arrays for iframes), take first
    const selectorStr = Array.isArray(selector) ? selector[0] : selector;
    
    // Remove html > body prefix (always present, not useful)
    let simplified = selectorStr
        .replace(/^html\s*>\s*body\s*>\s*/i, '')
        .replace(/^body\s*>\s*/i, '');
    
    // If still too long, show last 2 segments
    const segments = simplified.split('>').map(s => s.trim());
    if (segments.length > 3) {
        simplified = '... > ' + segments.slice(-2).join(' > ');
    }
    
    return simplified || selectorStr;
}

/**
 * Truncate HTML snippet for display
 * 
 * @param {string} html - HTML snippet
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated snippet
 */
export function truncateSnippet(html, maxLength = 80) {
    if (!html) return '';
    
    // Remove newlines and excess whitespace
    const clean = html.replace(/\s+/g, ' ').trim();
    
    if (clean.length <= maxLength) {
        return clean;
    }
    
    // Try to cut at a sensible point (end of attribute)
    const truncated = clean.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    if (lastSpace > maxLength * 0.5) {
        return truncated.substring(0, lastSpace) + '...';
    }
    
    return truncated + '...';
}
