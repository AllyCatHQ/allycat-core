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
 * Generate a terminal-clickable file link
 * Works in VS Code, iTerm2, and most modern terminals
 * 
 * @param {string} filePath - Absolute path to file
 * @param {number|null} lineNumber - Line number (optional)
 * @returns {string} - Clickable file URI
 */
export function generateFileLink(filePath, lineNumber = null) {
    const absolutePath = filePath.startsWith('/') 
        ? filePath 
        : `${process.cwd()}/${filePath}`;
    
    // VS Code uses file:// URIs with line numbers
    // Format: file:///path/to/file.html:lineNumber
    if (lineNumber) {
        return `${absolutePath}:${lineNumber}`;
    }
    
    return absolutePath;
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
