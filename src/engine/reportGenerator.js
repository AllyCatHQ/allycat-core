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

function countByImpact(violations) {
    return {
        critical: violations.filter(v => v.impact === 'critical').length,
        serious:  violations.filter(v => v.impact === 'serious').length,
        moderate: violations.filter(v => v.impact === 'moderate').length,
        minor:    violations.filter(v => v.impact === 'minor').length,
    };
}

/**
 * Extract unique WCAG tags from a set of violations, sorted numerically.
 * Returns array of { tag, count } objects for tags that appear on >1 violation
 * OR on any violation if the file has fewer than 3 unique tags.
 *
 * @param {Array} violations
 * @returns {Array<{tag: string, count: number}>}
 */
function extractWcagTags(violations) {
    const tagCounts = {};
    violations.forEach(v => {
        (v.wcagTags || []).forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
    });

    return Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }));
}

function impactColor(impact) {
    return {
        critical: '#ff4d4d',
        serious:  '#ff8c42',
        moderate: '#ffd166',
        minor:    '#06d6a0',
    }[impact] || '#888';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function resolveStandardLabel(standard) {
    return {
        'wcag-aa':  'WCAG 2.1 AA',
        'wcag-aaa': 'WCAG 2.1 AAA',
        'israel':   'Israeli Standard IS 5568',
    }[standard] || 'WCAG 2.1 AA';
}

// -----------------------------------------------------------------------------
// HTML Entry
// -----------------------------------------------------------------------------

function buildHtml(byFile, prompts, config, scanMode) {
    const files     = Object.keys(byFile);
    const timestamp = new Date().toLocaleString();
    const standard  = resolveStandardLabel(config?.selectedStandard);
    const promptMap = Object.fromEntries(prompts.map(p => [p.file, p.prompt]));

    return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>A11y-Guard Report</title>
<style>${buildStyles()}</style>
</head>
<body>
${buildHeader(byFile, standard, scanMode, timestamp)}
<div class="layout">
${buildSidebar(files, byFile)}
<div class="content" id="content">
${buildPanels(files, byFile, promptMap)}
</div>
</div>
${buildModal()}
<script>${buildScript()}</script>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// CSS
// -----------------------------------------------------------------------------

function buildStyles() {
    return `
    @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Syne:wght@400;600;800&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ── Dark theme (default) ────────────────────────────────────── */
    :root,
    [data-theme="dark"] {
        --bg:           #0d0d0f;
        --surface:      #141418;
        --surface2:     #1c1c22;
        --border:       #2a2a35;
        --accent:       #7c6af7;
        --accent-dim:   #3d3570;
        --text:         #e2e2e8;
        --text-dim:     #6b6b7e;
        --input-bg:     #1c1c22;
        --input-border: #2a2a35;
        --prompt-bg:    #0f0f14;
        --modal-bg:     #0c0c10;
        --filter-bg:    #1a1a20;
        --filter-active-bg: #3d3570;
        --filter-active-text: #b8aeff;
        --critical:   #ff4d4d;
        --serious:    #ff8c42;
        --moderate:   #ffd166;
        --minor:      #06d6a0;
        --mono:       'JetBrains Mono', monospace;
        --sans:       'Syne', sans-serif;
    }

    /* ── Light theme ─────────────────────────────────────────────── */
    [data-theme="light"] {
        --bg:           #f4f4f7;
        --surface:      #ffffff;
        --surface2:     #eeeef3;
        --border:       #d4d4de;
        --accent:       #5b4de0;
        --accent-dim:   #dddaf8;
        --text:         #18181f;
        --text-dim:     #7070888;
        --input-bg:     #f0f0f5;
        --input-border: #ccccd8;
        --prompt-bg:    #f8f8fc;
        --modal-bg:     #f2f2f7;
        --filter-bg:    #ebebf3;
        --filter-active-bg: #dddaf8;
        --filter-active-text: #4a3dc0;
        --critical:   #d42020;
        --serious:    #c05a10;
        --moderate:   #9a7000;
        --minor:      #057a52;
    }

    html { font-size: 17px; }

    body {
        background: var(--bg);
        color: var(--text);
        font-family: var(--sans);
        min-height: 100vh;
        line-height: 1.6;
        transition: background 0.2s ease, color 0.2s ease;
    }

    /* ── Combined Header (brand + stats + meta in one row) ──────── */

    .header {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        padding: 12px 36px;
        display: flex;
        align-items: center;
        gap: 20px;
    }

    .header-brand { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }

    .brand-icon {
        width: 36px; height: 36px;
        background: var(--accent);
        border-radius: 8px;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px; flex-shrink: 0;
    }

    .brand-name { font-size: 1.1rem; font-weight: 800; letter-spacing: -0.02em; }
    .brand-sub  { font-size: 0.68rem; color: var(--text-dim); font-family: var(--mono); margin-top: 1px; }

    /* Stats sit inline between brand and right section */
    .header-stats {
        display: flex;
        align-items: center;
        gap: 20px;
        flex: 1;
        padding: 0 24px;
        border-left: 1px solid var(--border);
        border-right: 1px solid var(--border);
        margin: 0 4px;
    }

    .stat { display: flex; flex-direction: column; gap: 1px; }

    .stat-value {
        font-size: 1.2rem; font-weight: 800;
        font-family: var(--mono); line-height: 1;
    }

    .stat-label {
        font-size: 0.6rem; color: var(--text-dim);
        text-transform: uppercase; letter-spacing: 0.08em;
    }

    .stat-critical { color: var(--critical); }
    .stat-serious  { color: var(--serious);  }
    .stat-moderate { color: var(--moderate); }
    .stat-minor    { color: var(--minor);    }
    .stat-total    { color: var(--text);     }

    .stat-divider { width: 1px; height: 28px; background: var(--border); }

    .header-right {
        display: flex; align-items: center; gap: 14px; flex-shrink: 0;
    }

    .header-meta {
        text-align: right;
        font-family: var(--mono);
        font-size: 0.67rem;
        color: var(--text-dim);
        line-height: 1.8;
    }

    /* ── Theme Toggle (icon button) ──────────────────────────────── */

    .theme-toggle {
        width: 34px;
        height: 34px;
        background: var(--surface2);
        border: 1px solid var(--border);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: border-color 0.14s, background 0.14s;
        padding: 0;
        color: var(--text-dim);
    }

    .theme-toggle:hover {
        border-color: var(--accent);
        background: var(--accent-dim);
        color: var(--accent);
    }

    .theme-toggle svg {
        width: 16px;
        height: 16px;
        fill: none;
        stroke: currentColor;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        transition: opacity 0.14s;
    }

    /* Show moon in dark mode, sun in light mode */
    .theme-toggle .icon-sun  { display: none; }
    .theme-toggle .icon-moon { display: block; }

    [data-theme="light"] .theme-toggle .icon-sun  { display: block; }
    [data-theme="light"] .theme-toggle .icon-moon { display: none; }

    /* ── Layout ──────────────────────────────────────────────────── */

    .layout { display: flex; height: calc(100vh - 62px); }

    /* ── Sidebar ─────────────────────────────────────────────────── */

    .sidebar {
        width: 275px; flex-shrink: 0;
        background: var(--surface);
        border-right: 1px solid var(--border);
        overflow-y: auto;
        display: flex; flex-direction: column;
    }

    /* File search input */
    .sidebar-search-wrap {
        padding: 12px 14px 8px;
        border-bottom: 1px solid var(--border);
        flex-shrink: 0;
    }

    .sidebar-search {
        width: 100%;
        background: var(--input-bg);
        border: 1px solid var(--input-border);
        border-radius: 7px;
        color: var(--text);
        font-family: var(--mono);
        font-size: 0.75rem;
        padding: 7px 10px 7px 30px;
        outline: none;
        transition: border-color 0.14s;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%236b6b7e' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='8'/%3E%3Cpath d='m21 21-4.35-4.35'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: 10px center;
    }

    .sidebar-search:focus { border-color: var(--accent); }
    .sidebar-search::placeholder { color: var(--text-dim); }

    .sidebar-label {
        font-size: 0.64rem; text-transform: uppercase;
        letter-spacing: 0.1em; color: var(--text-dim);
        padding: 10px 16px 6px;
        flex-shrink: 0;
    }

    .sidebar-files { flex: 1; overflow-y: auto; }

    .file-tab {
        padding: 11px 18px; cursor: pointer;
        border-left: 3px solid transparent;
        transition: all 0.12s ease; position: relative;
    }

    .file-tab:hover  { background: var(--surface2); }
    .file-tab.active { background: var(--surface2); border-left-color: var(--accent); }
    .file-tab.hidden { display: none; }

    .file-tab-name {
        font-family: var(--mono); font-size: 0.78rem; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 36px;
    }

    .file-tab-path {
        font-family: var(--mono); font-size: 0.67rem; color: var(--text-dim);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        margin-top: 2px; padding-right: 36px;
    }

    .file-tab-badge {
        position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
        background: var(--accent-dim); color: var(--accent);
        font-family: var(--mono); font-size: 0.64rem; font-weight: 600;
        padding: 2px 8px; border-radius: 20px;
    }

    .sidebar-empty {
        padding: 16px; font-size: 0.75rem;
        color: var(--text-dim); text-align: center; display: none;
    }

    /* ── Content ─────────────────────────────────────────────────── */

    .content { flex: 1; overflow-y: auto; padding: 26px 34px; }

    .panel { display: none; }
    .panel.active { display: block; }

    /* ── Panel Header ─────────────────────────────────────────────── */

    .panel-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 0; padding-bottom: 14px;
        border-bottom: 1px solid var(--border); gap: 12px;
    }

    .panel-header-left { min-width: 0; flex: 1; }

    .panel-filepath {
        font-family: var(--mono); font-size: 0.84rem; color: var(--accent);
        display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .panel-count {
        font-family: var(--mono); font-size: 0.72rem; color: var(--text-dim);
        margin-top: 2px; display: block;
    }

    .panel-header-right {
        display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }

    .copy-pill {
        display: flex; align-items: center; gap: 6px;
        background: var(--accent-dim); color: var(--accent);
        border: 1px solid var(--accent); padding: 7px 15px; border-radius: 20px;
        font-family: var(--mono); font-size: 0.7rem; font-weight: 600;
        cursor: pointer; transition: all 0.14s ease; white-space: nowrap;
    }

    .copy-pill:hover  { background: var(--accent); color: #fff; transform: translateY(-1px); }
    .copy-pill:active { transform: translateY(0); }
    .copy-pill.copied { background: #062e1f; color: var(--minor); border-color: var(--minor); }

    .expand-pill {
        display: flex; align-items: center; gap: 6px;
        background: transparent; color: var(--text-dim);
        border: 1px solid var(--border); padding: 7px 13px; border-radius: 20px;
        font-family: var(--mono); font-size: 0.7rem;
        cursor: pointer; transition: all 0.14s ease; white-space: nowrap;
    }

    .expand-pill:hover { border-color: var(--accent); color: var(--accent); }

    /* ── Impact Filter Bar (per panel) ───────────────────────────── */

    .filter-bar {
        display: flex; flex-direction: column; gap: 8px;
        padding: 12px 0 0;
    }

    .filter-row {
        display: flex; align-items: center; gap: 6px;
        flex-wrap: wrap;
    }

    .filter-label {
        font-size: 0.67rem; color: var(--text-dim);
        text-transform: uppercase; letter-spacing: 0.08em;
        margin-right: 4px; white-space: nowrap;
    }

    .filter-btn {
        background: var(--filter-bg);
        border: 1px solid var(--border);
        color: var(--text-dim);
        padding: 5px 12px;
        border-radius: 20px;
        font-family: var(--mono);
        font-size: 0.7rem;
        cursor: pointer;
        transition: all 0.12s ease;
        white-space: nowrap;
    }

    .filter-btn:hover { border-color: var(--accent); color: var(--accent); }

    .filter-btn.active {
        background: var(--filter-active-bg);
        color: var(--filter-active-text);
        border-color: var(--accent);
        font-weight: 600;
    }

    /* Impact-colored active states */
    .filter-btn[data-filter="critical"].active { background: #ff4d4d22; color: var(--critical); border-color: var(--critical); }
    .filter-btn[data-filter="serious"].active  { background: #ff8c4222; color: var(--serious);  border-color: var(--serious);  }
    .filter-btn[data-filter="moderate"].active { background: #ffd16622; color: var(--moderate); border-color: var(--moderate); }
    .filter-btn[data-filter="minor"].active    { background: #06d6a022; color: var(--minor);    border-color: var(--minor);    }

    .filter-count {
        display: inline-block;
        background: var(--surface2);
        color: var(--text-dim);
        font-size: 0.62rem;
        padding: 1px 6px;
        border-radius: 10px;
        margin-left: 3px;
    }

    .no-results {
        padding: 32px 0;
        text-align: center;
        font-size: 0.85rem;
        color: var(--text-dim);
        display: none;
    }

    /* ── Prompt Section ───────────────────────────────────────────── */

    .prompt-section {
        margin: 16px 0 20px;
        border: 1px solid var(--accent-dim);
        border-radius: 10px; overflow: hidden;
        background: var(--surface);
    }

    .prompt-bar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 11px 17px;
        background: linear-gradient(90deg, var(--accent-dim) 0%, var(--surface) 100%);
        border-bottom: 1px solid var(--accent-dim); gap: 12px;
    }

    .prompt-bar-label {
        display: flex; align-items: center; gap: 8px;
        font-size: 0.78rem; font-weight: 600; color: var(--accent);
    }

    .prompt-bar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

    .copy-btn {
        background: var(--accent); color: #fff; border: none;
        padding: 6px 15px; border-radius: 6px;
        font-family: var(--mono); font-size: 0.7rem; font-weight: 600;
        cursor: pointer; transition: all 0.14s ease; white-space: nowrap;
    }

    .copy-btn:hover  { background: #9585fa; transform: translateY(-1px); }
    .copy-btn:active { transform: translateY(0); }
    .copy-btn.copied { background: var(--minor); color: #0a2e22; }

    .expand-btn {
        background: transparent; border: 1px solid var(--border); color: var(--text-dim);
        padding: 5px 10px; border-radius: 6px; font-size: 0.82rem;
        cursor: pointer; transition: all 0.14s ease; line-height: 1;
    }

    .expand-btn:hover { border-color: var(--accent); color: var(--accent); }

    .prompt-preview-wrap {
        position: relative; max-height: 82px; overflow: hidden;
    }

    .prompt-preview-wrap::after {
        content: '';
        position: absolute; bottom: 0; left: 0; right: 0; height: 46px;
        background: linear-gradient(transparent, var(--prompt-bg));
        pointer-events: none;
    }

    .prompt-body {
        padding: 13px 17px;
        font-family: var(--mono); font-size: 0.76rem;
        line-height: 1.75; color: var(--text);
        white-space: pre-wrap; word-break: break-word;
        background: var(--prompt-bg);
        opacity: 0.85;
    }

    /* ── Violation Cards ─────────────────────────────────────────── */

    .violations-wrap { margin-top: 14px; }

    .violation {
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 9px; margin-bottom: 11px; overflow: hidden;
        transition: border-color 0.14s;
    }

    .violation:hover { border-color: var(--accent-dim); }
    .violation.hidden { display: none; }

    .violation-header {
        display: flex; align-items: center; gap: 12px;
        padding: 12px 16px; border-bottom: 1px solid var(--border);
    }

    .impact-badge {
        font-family: var(--mono); font-size: 0.64rem; font-weight: 600;
        padding: 4px 9px; border-radius: 5px;
        text-transform: uppercase; letter-spacing: 0.06em; flex-shrink: 0;
    }

    .violation-desc { font-size: 0.95rem; font-weight: 600; color: var(--text); flex: 1; }

    .violation-line { font-family: var(--mono); font-size: 0.72rem; color: var(--text-dim); flex-shrink: 0; }

    .violation-body {
        padding: 13px 16px;
        display: grid; grid-template-columns: 1fr 1fr; gap: 11px 22px;
    }

    .vfield-label {
        font-size: 0.64rem; text-transform: uppercase;
        letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 3px;
    }

    .vfield-value { font-family: var(--mono); font-size: 0.77rem; color: var(--text); word-break: break-all; }

    .vfield-value.code {
        background: var(--surface2); padding: 6px 11px;
        border-radius: 5px; border: 1px solid var(--border);
        display: block; white-space: pre-wrap; word-break: break-word;
    }

    .vfield-full { grid-column: 1 / -1; }

    .help-link { color: var(--accent); text-decoration: none; font-size: 0.74rem; }
    .help-link:hover { text-decoration: underline; }

    /* ── Modal ───────────────────────────────────────────────────── */

    .modal-overlay {
        display: none; position: fixed; inset: 0;
        background: rgba(0,0,0,0.82); z-index: 1000;
        align-items: center; justify-content: center;
        padding: 32px; backdrop-filter: blur(4px);
    }

    .modal-overlay.open { display: flex; }

    .modal {
        background: var(--surface);
        border: 1px solid var(--accent-dim);
        border-radius: 14px; width: 100%; max-width: 900px; max-height: 88vh;
        display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 32px 80px rgba(0,0,0,0.55);
        animation: modalIn 0.16s ease;
    }

    @keyframes modalIn {
        from { opacity: 0; transform: scale(0.96) translateY(10px); }
        to   { opacity: 1; transform: scale(1)    translateY(0);    }
    }

    .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 17px 24px;
        background: linear-gradient(90deg, var(--accent-dim) 0%, var(--surface) 100%);
        border-bottom: 1px solid var(--accent-dim);
        flex-shrink: 0; gap: 16px;
    }

    .modal-title {
        display: flex; align-items: center; gap: 10px;
        font-weight: 700; font-size: 0.92rem; color: var(--accent);
    }

    .modal-filepath {
        font-family: var(--mono); font-size: 0.72rem;
        color: var(--text-dim); margin-top: 3px;
    }

    .modal-actions { display: flex; align-items: center; gap: 10px; }

    .modal-copy-btn {
        background: var(--accent); color: #fff; border: none;
        padding: 9px 22px; border-radius: 8px;
        font-family: var(--mono); font-size: 0.74rem; font-weight: 600;
        cursor: pointer; transition: all 0.14s ease;
    }

    .modal-copy-btn:hover  { background: #9585fa; }
    .modal-copy-btn.copied { background: var(--minor); color: #0a2e22; }

    .modal-close {
        background: transparent; border: 1px solid var(--border); color: var(--text-dim);
        width: 36px; height: 36px; border-radius: 8px; font-size: 1rem;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 0.14s; line-height: 1;
    }

    .modal-close:hover { border-color: var(--critical); color: var(--critical); }

    .modal-body {
        overflow-y: auto; flex: 1; padding: 26px 30px;
        font-family: var(--mono); font-size: 0.84rem;
        line-height: 1.82; color: var(--text);
        white-space: pre-wrap; word-break: break-word;
        background: var(--modal-bg);
    }

    /* ── Scrollbars ──────────────────────────────────────────────── */

    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: var(--bg); }
    ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
    `;
}

// -----------------------------------------------------------------------------
// HTML Builders
// -----------------------------------------------------------------------------

function buildHeader(byFile, standard, scanMode, timestamp) {
    const all    = Object.values(byFile).flat();
    const counts = countByImpact(all);
    const files  = Object.keys(byFile).length;

    return `
<div class="header">
    <div class="header-brand">
        <div class="brand-icon">♿</div>
        <div>
            <div class="brand-name">A11y-Guard</div>
            <div class="brand-sub">Accessibility Scan Report</div>
        </div>
    </div>
    <div class="header-stats">
        <div class="stat">
            <div class="stat-value stat-total">${all.length}</div>
            <div class="stat-label">Total</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
            <div class="stat-value stat-critical">${counts.critical}</div>
            <div class="stat-label">Critical</div>
        </div>
        <div class="stat">
            <div class="stat-value stat-serious">${counts.serious}</div>
            <div class="stat-label">Serious</div>
        </div>
        <div class="stat">
            <div class="stat-value stat-moderate">${counts.moderate}</div>
            <div class="stat-label">Moderate</div>
        </div>
        <div class="stat">
            <div class="stat-value stat-minor">${counts.minor}</div>
            <div class="stat-label">Minor</div>
        </div>
        <div class="stat-divider"></div>
        <div class="stat">
            <div class="stat-value stat-total">${files}</div>
            <div class="stat-label">Files</div>
        </div>
    </div>
    <div class="header-right">
        <button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" title="Toggle light/dark mode">
            <svg class="icon-moon" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg class="icon-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </button>
        <div class="header-meta">
            <div>Standard: ${escapeHtml(standard)}</div>
            <div>Mode: ${scanMode === 'full' ? 'Full (contrast)' : 'Quick'}</div>
            <div>${escapeHtml(timestamp)}</div>
        </div>
    </div>
</div>`;
}

function buildSidebar(files, byFile) {
    const tabs = files.map((file, i) => {
        const count = byFile[file].length;
        const name  = path.basename(file);
        const dir   = path.dirname(file);
        return `
        <div class="file-tab ${i === 0 ? 'active' : ''}" onclick="switchTab(${i})" data-index="${i}" data-filename="${escapeHtml(name.toLowerCase())}">
            <div class="file-tab-name">${escapeHtml(name)}</div>
            <div class="file-tab-path">${escapeHtml(dir)}</div>
            <span class="file-tab-badge">${count}</span>
        </div>`;
    }).join('');

    return `
    <div class="sidebar">
        <div class="sidebar-search-wrap">
            <input
                class="sidebar-search"
                id="sidebar-search"
                type="text"
                placeholder="Filter files…"
                oninput="filterSidebar(this.value)"
                autocomplete="off"
                spellcheck="false"
            />
        </div>
        <div class="sidebar-label">Files</div>
        <div class="sidebar-files" id="sidebar-files">
            ${tabs}
        </div>
        <div class="sidebar-empty" id="sidebar-empty">No files match</div>
    </div>`;
}

function buildPanels(files, byFile, promptMap) {
    return files.map((file, i) => {
        const violations = byFile[file];
        const prompt     = promptMap[file] || null;

        // Sort by severity, then line number
        const sorted = [...violations].sort((a, b) => {
            const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
            return (order[a.impact] ?? 4) - (order[b.impact] ?? 4);
        });

        const counts   = countByImpact(violations);
        const cards    = sorted.map(v => buildViolationCard(v)).join('');

        const headerActions = prompt ? `
                <div class="panel-header-right">
                    <button class="copy-pill" onclick="copyPrompt(${i}, this)">✦ Copy AI Prompt</button>
                    <button class="expand-pill" onclick="openModal(${i})">⛶ Full View</button>
                </div>` : '';

        const promptSection = prompt ? buildPromptSection(prompt, i) : '';

        return `
        <div class="panel ${i === 0 ? 'active' : ''}" data-index="${i}">
            <div class="panel-header">
                <div class="panel-header-left">
                    <span class="panel-filepath">${escapeHtml(file)}</span>
                    <span class="panel-count">${violations.length} issue${violations.length !== 1 ? 's' : ''}</span>
                </div>
                ${headerActions}
            </div>
            ${buildFilterBar(counts, i, violations)}
            ${promptSection}
            <div class="violations-wrap" id="violations-${i}">
                ${cards}
            </div>
            <div class="no-results" id="no-results-${i}">No violations match this filter</div>
        </div>`;
    }).join('');
}

/**
 * Build the filter bar for a single panel.
 * Row 1: impact-level buttons (All / Critical / Serious / Moderate / Minor)
 * Row 2: WCAG tag buttons — one per unique tag found in this file's violations
 *
 * Only renders if there is meaningful variety to filter on.
 *
 * @param {Object} counts      - { critical, serious, moderate, minor }
 * @param {number} panelIndex
 * @param {Array}  violations  - raw violations for this file (for WCAG tag extraction)
 */
function buildFilterBar(counts, panelIndex, violations) {
    const levels = [
        { key: 'critical', label: 'Critical' },
        { key: 'serious',  label: 'Serious'  },
        { key: 'moderate', label: 'Moderate' },
        { key: 'minor',    label: 'Minor'    },
    ].filter(l => counts[l.key] > 0);

    const total    = Object.values(counts).reduce((a, b) => a + b, 0);
    const wcagTags = extractWcagTags(violations);

    // Only show impact row when more than one impact level exists
    const showImpact = levels.length > 1;
    // Only show WCAG row when more than one unique tag exists
    const showWcag   = wcagTags.length > 1;

    if (!showImpact && !showWcag) return '';

    const impactRow = showImpact ? `
        <div class="filter-row">
            <span class="filter-label">Severity:</span>
            <button class="filter-btn active" data-filter="all" data-filter-type="impact" onclick="filterPanel(${panelIndex}, 'all', 'impact', this)">
                All<span class="filter-count">${total}</span>
            </button>
            ${levels.map(l => `
            <button class="filter-btn" data-filter="${l.key}" data-filter-type="impact" onclick="filterPanel(${panelIndex}, '${l.key}', 'impact', this)">
                ${l.label}<span class="filter-count">${counts[l.key]}</span>
            </button>`).join('')}
        </div>` : '';

    const wcagRow = showWcag ? `
        <div class="filter-row">
            <span class="filter-label">WCAG:</span>
            <button class="filter-btn active" data-filter="all" data-filter-type="wcag" onclick="filterPanel(${panelIndex}, 'all', 'wcag', this)">
                All<span class="filter-count">${total}</span>
            </button>
            ${wcagTags.map(({ tag, count }) => `
            <button class="filter-btn" data-filter="${escapeHtml(tag)}" data-filter-type="wcag" onclick="filterPanel(${panelIndex}, '${escapeHtml(tag)}', 'wcag', this)">
                ${escapeHtml(tag)}<span class="filter-count">${count}</span>
            </button>`).join('')}
        </div>` : '';

    return `
    <div class="filter-bar" id="filter-bar-${panelIndex}">
        ${impactRow}
        ${wcagRow}
    </div>`;
}

function buildPromptSection(prompt, index) {
    const escaped = escapeHtml(prompt);
    return `
    <div class="prompt-section">
        <div class="prompt-bar">
            <div class="prompt-bar-label">
                <span>✦</span>
                AI Fix Prompt — paste into your AI agent to fix all issues in this file
            </div>
            <div class="prompt-bar-actions">
                <button class="copy-btn" onclick="copyPrompt(${index}, this)">Copy</button>
                <button class="expand-btn" title="Open full prompt (readable view)" onclick="openModal(${index})">⛶</button>
            </div>
        </div>
        <div class="prompt-preview-wrap">
            <div class="prompt-body" id="prompt-${index}">${escaped}</div>
        </div>
    </div>`;
}

function buildViolationCard(v) {
    const color      = impactColor(v.impact);
    const badgeStyle = `background:${color}22;color:${color};border:1px solid ${color}55;`;

    const wcagAttr = v.wcagTags?.length
        ? `data-wcag="${escapeHtml(v.wcagTags.join(' '))}"`
        : '';

    return `
    <div class="violation" data-impact="${escapeHtml(v.impact || 'unknown')}" ${wcagAttr}>
        <div class="violation-header">
            <span class="impact-badge" style="${badgeStyle}">${escapeHtml(v.impact || 'unknown')}</span>
            <span class="violation-desc">${escapeHtml(v.description)}</span>
            ${v.lineNumber ? `<span class="violation-line">Line ${v.lineNumber}</span>` : ''}
        </div>
        <div class="violation-body">
            <div>
                <div class="vfield-label">Rule</div>
                <div class="vfield-value">${escapeHtml(v.id)}</div>
            </div>
            ${v.wcagTags?.length ? `
            <div>
                <div class="vfield-label">WCAG</div>
                <div class="vfield-value">${escapeHtml(v.wcagTags.slice(0, 3).join(', '))}</div>
            </div>` : ''}
            ${v.html ? `
            <div class="vfield-full">
                <div class="vfield-label">Element</div>
                <code class="vfield-value code">${escapeHtml(v.html)}</code>
            </div>` : ''}
            <div class="vfield-full">
                <div class="vfield-label">How to fix</div>
                <div class="vfield-value">${escapeHtml(v.help)}${v.helpUrl
                    ? ` <a class="help-link" href="${escapeHtml(v.helpUrl)}" target="_blank">Learn more ↗</a>`
                    : ''}</div>
            </div>
        </div>
    </div>`;
}

function buildModal() {
    return `
<div class="modal-overlay" id="modal-overlay" onclick="closeModalOnOverlay(event)">
    <div class="modal">
        <div class="modal-header">
            <div>
                <div class="modal-title"><span>✦</span> AI Fix Prompt</div>
                <div class="modal-filepath" id="modal-filepath"></div>
            </div>
            <div class="modal-actions">
                <button class="modal-copy-btn" id="modal-copy-btn" onclick="copyModalPrompt(this)">Copy Prompt</button>
                <button class="modal-close" onclick="closeModal()" title="Close (Esc)">✕</button>
            </div>
        </div>
        <div class="modal-body" id="modal-body"></div>
    </div>
</div>`;
}

// -----------------------------------------------------------------------------
// JavaScript
// -----------------------------------------------------------------------------

function buildScript() {
    return `
    // ── State ──────────────────────────────────────────────────────

    const rawPrompts    = {};
    const fileNames     = {};

    document.querySelectorAll('.prompt-body').forEach(el => {
        rawPrompts[el.id.split('-')[1]] = el.textContent;
    });

    document.querySelectorAll('.panel').forEach(panel => {
        const fp = panel.querySelector('.panel-filepath');
        if (fp) fileNames[panel.dataset.index] = fp.textContent;
    });

    // ── Theme ──────────────────────────────────────────────────────

    (function initTheme() {
        const saved = localStorage.getItem('a11y-theme') || 'dark';
        applyTheme(saved);
    })();

    function toggleTheme() {
        const current = document.documentElement.dataset.theme;
        applyTheme(current === 'dark' ? 'light' : 'dark');
    }

    function applyTheme(theme) {
        document.documentElement.dataset.theme = theme;
        localStorage.setItem('a11y-theme', theme);
    }

    // ── Tab switching ──────────────────────────────────────────────

    function switchTab(index) {
        document.querySelectorAll('.file-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        const tab = document.querySelector('.file-tab[data-index="' + index + '"]');
        const panel = document.querySelector('.panel[data-index="' + index + '"]');
        if (tab)   tab.classList.add('active');
        if (panel) panel.classList.add('active');
    }

    // ── Sidebar file search ────────────────────────────────────────

    function filterSidebar(query) {
        const q     = query.toLowerCase().trim();
        const tabs  = document.querySelectorAll('.file-tab');
        let visible = 0;

        tabs.forEach(tab => {
            const name = tab.dataset.filename || '';
            const match = !q || name.includes(q);
            tab.classList.toggle('hidden', !match);
            if (match) visible++;
        });

        const empty = document.getElementById('sidebar-empty');
        if (empty) empty.style.display = visible === 0 ? 'block' : 'none';
    }

    // ── Impact + WCAG filter (per panel, two independent dimensions) ──

    // Per-panel filter state: { impact: 'all'|..., wcag: 'all'|'X.X.X' }
    const panelFilterState = {};

    document.querySelectorAll('.panel').forEach(panel => {
        panelFilterState[panel.dataset.index] = { impact: 'all', wcag: 'all' };
    });

    function filterPanel(panelIndex, value, type, clickedBtn) {
        const idx   = String(panelIndex);
        const state = panelFilterState[idx] || { impact: 'all', wcag: 'all' };
        state[type] = value;
        panelFilterState[idx] = state;

        // Update active button state within this filter type's row only
        const bar = document.getElementById('filter-bar-' + panelIndex);
        if (bar) {
            bar.querySelectorAll('.filter-btn[data-filter-type="' + type + '"]').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.filter === value);
            });
        }

        // Show/hide cards: card must pass BOTH active filters
        const wrap = document.getElementById('violations-' + panelIndex);
        if (!wrap) return;

        let visible = 0;
        wrap.querySelectorAll('.violation').forEach(card => {
            const matchImpact = state.impact === 'all' || card.dataset.impact === state.impact;
            const cardWcag    = card.dataset.wcag || '';
            const matchWcag   = state.wcag === 'all' || cardWcag.split(' ').includes(state.wcag);
            const show = matchImpact && matchWcag;
            card.classList.toggle('hidden', !show);
            if (show) visible++;
        });

        const noResults = document.getElementById('no-results-' + panelIndex);
        if (noResults) noResults.style.display = visible === 0 ? 'block' : 'none';
    }

    // ── Copy helper ────────────────────────────────────────────────

    function doCopy(text, btn, originalLabel) {
        const restore   = () => { btn.textContent = originalLabel; btn.classList.remove('copied'); };
        const onSuccess = () => {
            btn.textContent = '✓ Copied!';
            btn.classList.add('copied');
            setTimeout(restore, 2200);
        };

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text).then(onSuccess).catch(fallback);
        } else { fallback(); }

        function fallback() {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            onSuccess();
        }
    }

    function copyPrompt(index, btn) {
        const text = rawPrompts[String(index)];
        if (!text) return;
        doCopy(text, btn, btn.textContent.trim());
    }

    // ── Modal ──────────────────────────────────────────────────────

    let currentModalIndex = null;

    function openModal(index) {
        const text = rawPrompts[String(index)] || '';
        document.getElementById('modal-body').textContent     = text;
        document.getElementById('modal-filepath').textContent = fileNames[String(index)] || '';

        const copyBtn = document.getElementById('modal-copy-btn');
        copyBtn.textContent = 'Copy Prompt';
        copyBtn.classList.remove('copied');

        currentModalIndex = index;
        document.getElementById('modal-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.remove('open');
        document.body.style.overflow = '';
        currentModalIndex = null;
    }

    function closeModalOnOverlay(e) {
        if (e.target === document.getElementById('modal-overlay')) closeModal();
    }

    function copyModalPrompt(btn) {
        if (currentModalIndex === null) return;
        doCopy(rawPrompts[String(currentModalIndex)] || '', btn, 'Copy Prompt');
    }

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    `;
}