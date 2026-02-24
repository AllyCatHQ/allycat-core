/**
 * Report Generator
 *
 * Builds a self-contained HTML report from scan violations + AI prompts.
 * Opens automatically in the default browser after scan completes.
 *
 * Design: Dark IDE aesthetic — monospace accents, file tabs, one-click copy.
 * Zero external dependencies — pure HTML/CSS/JS, single file output.
 *
 * UX decisions:
 *  - AI prompt appears at TOP of each panel (not bottom) for immediate access
 *  - Collapsed to ~4 lines with fade gradient so it doesn't overwhelm
 *  - Panel header always shows "Copy AI Prompt" pill — zero scrolling required
 *  - "Full View" pill + ⛶ button open a full-screen modal with large readable prompt
 *  - Escape key and overlay click close the modal
 *  - Dark mode default, light mode toggle in header (persisted via localStorage)
 *  - Per-panel impact filter bar (All / Critical / Serious / Moderate / Minor)
 *  - Sidebar file search — filters file tabs by name in real-time
 *
 * @module engine/reportGenerator
 */

import fs   from 'fs';
import path from 'path';
import { generatePrompts } from './promptGenerator.js';
import { buildHtml } from './reportHtml.js';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Generate the HTML report file and return its absolute path.
 *
 * @param {Array<Object>} violations - All violations from the scan
 * @param {Object} config            - User configuration
 * @param {string} scanMode          - 'quick' or 'full'
 * @returns {string} - Absolute path to the generated HTML file
 */
export function generateReport(violations, config, scanMode) {
    const prompts = generatePrompts(violations, config);
    const byFile  = groupViolationsByFile(violations);
    const html    = buildHtml(byFile, prompts, config, scanMode);

    const outputPath = path.resolve(process.cwd(), 'a11y-report.html');
    fs.writeFileSync(outputPath, html, 'utf8');
    return outputPath;
}

// -----------------------------------------------------------------------------
// Data Helpers
// -----------------------------------------------------------------------------

function groupViolationsByFile(violations) {
    return violations.reduce((acc, v) => {
        if (!acc[v.file]) acc[v.file] = [];
        acc[v.file].push(v);
        return acc;
    }, {});
}
