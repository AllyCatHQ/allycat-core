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
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>A11y-Guard Report</title>
<style>${buildStyles()}</style>
</head>
<body>
${buildHeader(standard, scanMode, timestamp)}
${buildStatsBar(byFile)}
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

    :root {
        --bg:         #0d0d0f;
        --surface:    #141418;
        --surface2:   #1c1c22;
        --border:     #2a2a35;
        --accent:     #7c6af7;
        --accent-dim: #3d3570;
        --text:       #e2e2e8;
        --text-dim:   #6b6b7e;
        --critical:   #ff4d4d;
        --serious:    #ff8c42;
        --moderate:   #ffd166;
        --minor:      #06d6a0;
        --mono:       'JetBrains Mono', monospace;
        --sans:       'Syne', sans-serif;
    }

    html { font-size: 16px; }

    body {
        background: var(--bg);
        color: var(--text);
        font-family: var(--sans);
        min-height: 100vh;
        line-height: 1.6;
    }

    /* ── Header ──────────────────────────────────────────────────── */

    .header {
        background: var(--surface);
        border-bottom: 1px solid var(--border);
        padding: 20px 36px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
    }

    .header-brand { display: flex; align-items: center; gap: 14px; }

    .brand-icon {
        width: 40px; height: 40px;
        background: var(--accent);
        border-radius: 10px;
        display: flex; align-items: center; justify-content: center;
        font-size: 20px; flex-shrink: 0;
    }

    .brand-name { font-size: 1.25rem; font-weight: 800; letter-spacing: -0.02em; }
    .brand-sub  { font-size: 0.72rem; color: var(--text-dim); font-family: var(--mono); margin-top: 2px; }

    .header-meta {
        text-align: right;
        font-family: var(--mono);
        font-size: 0.72rem;
        color: var(--text-dim);
        line-height: 1.9;
    }

    /* ── Stats Bar ───────────────────────────────────────────────── */

    .stats-bar {
        background: var(--surface2);
        border-bottom: 1px solid var(--border);
        padding: 14px 36px;
        display: flex;
        gap: 28px;
        align-items: center;
    }

    .stat { display: flex; flex-direction: column; gap: 2px; }

    .stat-value {
        font-size: 1.45rem; font-weight: 800;
        font-family: var(--mono); line-height: 1;
    }

    .stat-label {
        font-size: 0.65rem; color: var(--text-dim);
        text-transform: uppercase; letter-spacing: 0.08em;
    }

    .stat-critical { color: var(--critical); }
    .stat-serious  { color: var(--serious);  }
    .stat-moderate { color: var(--moderate); }
    .stat-minor    { color: var(--minor);    }
    .stat-total    { color: var(--text);     }

    .stat-divider { width: 1px; height: 32px; background: var(--border); }

    /* ── Layout ──────────────────────────────────────────────────── */

    .layout { display: flex; height: calc(100vh - 138px); }

    /* ── Sidebar ─────────────────────────────────────────────────── */

    .sidebar {
        width: 260px; flex-shrink: 0;
        background: var(--surface);
        border-right: 1px solid var(--border);
        overflow-y: auto; padding: 12px 0;
    }

    .sidebar-label {
        font-size: 0.62rem; text-transform: uppercase;
        letter-spacing: 0.1em; color: var(--text-dim);
        padding: 4px 18px 10px;
    }

    .file-tab {
        padding: 10px 18px; cursor: pointer;
        border-left: 3px solid transparent;
        transition: all 0.12s ease; position: relative;
    }

    .file-tab:hover  { background: var(--surface2); }
    .file-tab.active { background: var(--surface2); border-left-color: var(--accent); }

    .file-tab-name {
        font-family: var(--mono); font-size: 0.76rem; color: var(--text);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding-right: 32px;
    }

    .file-tab-path {
        font-family: var(--mono); font-size: 0.64rem; color: var(--text-dim);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        margin-top: 2px; padding-right: 32px;
    }

    .file-tab-badge {
        position: absolute; right: 12px; top: 50%; transform: translateY(-50%);
        background: var(--accent-dim); color: var(--accent);
        font-family: var(--mono); font-size: 0.62rem; font-weight: 600;
        padding: 2px 7px; border-radius: 20px;
    }

    /* ── Content ─────────────────────────────────────────────────── */

    .content { flex: 1; overflow-y: auto; padding: 24px 32px; }

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
        font-family: var(--mono); font-size: 0.82rem; color: var(--accent);
        display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    .panel-count {
        font-family: var(--mono); font-size: 0.7rem; color: var(--text-dim);
        margin-top: 2px; display: block;
    }

    /* Prompt action pills — always in view, zero scrolling needed */
    .panel-header-right {
        display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }

    .copy-pill {
        display: flex; align-items: center; gap: 6px;
        background: var(--accent-dim); color: var(--accent);
        border: 1px solid var(--accent); padding: 6px 14px; border-radius: 20px;
        font-family: var(--mono); font-size: 0.68rem; font-weight: 600;
        cursor: pointer; transition: all 0.14s ease; white-space: nowrap;
    }

    .copy-pill:hover  { background: var(--accent); color: #fff; transform: translateY(-1px); }
    .copy-pill:active { transform: translateY(0); }
    .copy-pill.copied { background: #062e1f; color: var(--minor); border-color: var(--minor); }

    .expand-pill {
        display: flex; align-items: center; gap: 6px;
        background: transparent; color: var(--text-dim);
        border: 1px solid var(--border); padding: 6px 12px; border-radius: 20px;
        font-family: var(--mono); font-size: 0.68rem;
        cursor: pointer; transition: all 0.14s ease; white-space: nowrap;
    }

    .expand-pill:hover { border-color: var(--accent); color: var(--accent); }

    /* ── Prompt Section — collapsed preview at top of panel ──────── */

    .prompt-section {
        margin: 14px 0 20px;
        border: 1px solid var(--accent-dim);
        border-radius: 10px; overflow: hidden;
        background: var(--surface);
    }

    .prompt-bar {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 16px;
        background: linear-gradient(90deg, #1a1730 0%, var(--surface) 100%);
        border-bottom: 1px solid var(--accent-dim); gap: 12px;
    }

    .prompt-bar-label {
        display: flex; align-items: center; gap: 8px;
        font-size: 0.76rem; font-weight: 600; color: var(--accent);
    }

    .prompt-bar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

    .copy-btn {
        background: var(--accent); color: #fff; border: none;
        padding: 5px 14px; border-radius: 6px;
        font-family: var(--mono); font-size: 0.68rem; font-weight: 600;
        cursor: pointer; transition: all 0.14s ease; white-space: nowrap;
    }

    .copy-btn:hover  { background: #9585fa; transform: translateY(-1px); }
    .copy-btn:active { transform: translateY(0); }
    .copy-btn.copied { background: var(--minor); color: #0a2e22; }

    .expand-btn {
        background: transparent; border: 1px solid var(--border); color: var(--text-dim);
        padding: 5px 9px; border-radius: 6px; font-size: 0.8rem;
        cursor: pointer; transition: all 0.14s ease; line-height: 1;
    }

    .expand-btn:hover { border-color: var(--accent); color: var(--accent); }

    /* Faded 4-line preview */
    .prompt-preview-wrap {
        position: relative; max-height: 80px; overflow: hidden;
    }

    .prompt-preview-wrap::after {
        content: '';
        position: absolute; bottom: 0; left: 0; right: 0; height: 46px;
        background: linear-gradient(transparent, #0f0f14);
        pointer-events: none;
    }

    .prompt-body {
        padding: 12px 16px;
        font-family: var(--mono); font-size: 0.74rem;
        line-height: 1.75; color: #c8c8d8;
        white-space: pre-wrap; word-break: break-word;
        background: #0f0f14;
    }

    /* ── Violation Cards ─────────────────────────────────────────── */

    .violation {
        background: var(--surface); border: 1px solid var(--border);
        border-radius: 8px; margin-bottom: 10px; overflow: hidden;
        transition: border-color 0.14s;
    }

    .violation:hover { border-color: var(--accent-dim); }

    .violation-header {
        display: flex; align-items: center; gap: 12px;
        padding: 11px 15px; border-bottom: 1px solid var(--border);
    }

    .impact-badge {
        font-family: var(--mono); font-size: 0.62rem; font-weight: 600;
        padding: 3px 8px; border-radius: 4px;
        text-transform: uppercase; letter-spacing: 0.06em; flex-shrink: 0;
    }

    .violation-desc { font-size: 0.92rem; font-weight: 600; color: var(--text); flex: 1; }

    .violation-line { font-family: var(--mono); font-size: 0.7rem; color: var(--text-dim); flex-shrink: 0; }

    .violation-body {
        padding: 12px 15px;
        display: grid; grid-template-columns: 1fr 1fr; gap: 10px 20px;
    }

    .vfield-label {
        font-size: 0.62rem; text-transform: uppercase;
        letter-spacing: 0.08em; color: var(--text-dim); margin-bottom: 3px;
    }

    .vfield-value { font-family: var(--mono); font-size: 0.75rem; color: var(--text); word-break: break-all; }

    .vfield-value.code {
        background: var(--surface2); padding: 6px 10px;
        border-radius: 5px; border: 1px solid var(--border);
        display: block; white-space: pre-wrap; word-break: break-word;
    }

    .vfield-full { grid-column: 1 / -1; }

    .help-link { color: var(--accent); text-decoration: none; font-size: 0.72rem; }
    .help-link:hover { text-decoration: underline; }

    /* ── Full-screen Modal ───────────────────────────────────────── */

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
        border-radius: 14px; width: 100%; max-width: 880px; max-height: 88vh;
        display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 32px 80px rgba(0,0,0,0.65);
        animation: modalIn 0.16s ease;
    }

    @keyframes modalIn {
        from { opacity: 0; transform: scale(0.96) translateY(10px); }
        to   { opacity: 1; transform: scale(1)    translateY(0);    }
    }

    .modal-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 22px;
        background: linear-gradient(90deg, #1a1730 0%, var(--surface) 100%);
        border-bottom: 1px solid var(--accent-dim);
        flex-shrink: 0; gap: 16px;
    }

    .modal-title {
        display: flex; align-items: center; gap: 10px;
        font-weight: 700; font-size: 0.9rem; color: var(--accent);
    }

    .modal-filepath {
        font-family: var(--mono); font-size: 0.7rem;
        color: var(--text-dim); margin-top: 3px;
    }

    .modal-actions { display: flex; align-items: center; gap: 10px; }

    .modal-copy-btn {
        background: var(--accent); color: #fff; border: none;
        padding: 8px 20px; border-radius: 8px;
        font-family: var(--mono); font-size: 0.72rem; font-weight: 600;
        cursor: pointer; transition: all 0.14s ease;
    }

    .modal-copy-btn:hover  { background: #9585fa; }
    .modal-copy-btn.copied { background: var(--minor); color: #0a2e22; }

    .modal-close {
        background: transparent; border: 1px solid var(--border); color: var(--text-dim);
        width: 34px; height: 34px; border-radius: 8px; font-size: 1rem;
        cursor: pointer; display: flex; align-items: center; justify-content: center;
        transition: all 0.14s; line-height: 1;
    }

    .modal-close:hover { border-color: var(--critical); color: var(--critical); }

    .modal-body {
        overflow-y: auto; flex: 1; padding: 24px 28px;
        font-family: var(--mono); font-size: 0.82rem;
        line-height: 1.82; color: #d0d0de;
        white-space: pre-wrap; word-break: break-word;
        background: #0c0c10;
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

function buildHeader(standard, scanMode, timestamp) {
    return `
<div class="header">
    <div class="header-brand">
        <div class="brand-icon">♿</div>
        <div>
            <div class="brand-name">A11y-Guard</div>
            <div class="brand-sub">Accessibility Scan Report</div>
        </div>
    </div>
    <div class="header-meta">
        <div>Standard: ${escapeHtml(standard)}</div>
        <div>Mode: ${scanMode === 'full' ? 'Full (contrast enabled)' : 'Quick'}</div>
        <div>Generated: ${escapeHtml(timestamp)}</div>
    </div>
</div>`;
}

function buildStatsBar(byFile) {
    const all    = Object.values(byFile).flat();
    const counts = countByImpact(all);

    return `
<div class="stats-bar">
    <div class="stat">
        <div class="stat-value stat-total">${all.length}</div>
        <div class="stat-label">Total Issues</div>
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
        <div class="stat-value stat-total">${Object.keys(byFile).length}</div>
        <div class="stat-label">Files</div>
    </div>
</div>`;
}

function buildSidebar(files, byFile) {
    const tabs = files.map((file, i) => {
        const count = byFile[file].length;
        const name  = path.basename(file);
        const dir   = path.dirname(file);
        return `
        <div class="file-tab ${i === 0 ? 'active' : ''}" onclick="switchTab(${i})" data-index="${i}">
            <div class="file-tab-name">${escapeHtml(name)}</div>
            <div class="file-tab-path">${escapeHtml(dir)}</div>
            <span class="file-tab-badge">${count}</span>
        </div>`;
    }).join('');

    return `
    <div class="sidebar">
        <div class="sidebar-label">Files</div>
        ${tabs}
    </div>`;
}

function buildPanels(files, byFile, promptMap) {
    return files.map((file, i) => {
        const violations = byFile[file];
        const prompt     = promptMap[file] || null;

        const cards = violations
            .sort((a, b) => {
                const order = { critical: 0, serious: 1, moderate: 2, minor: 3 };
                return (order[a.impact] ?? 4) - (order[b.impact] ?? 4);
            })
            .map(v => buildViolationCard(v))
            .join('');

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
            ${promptSection}
            ${cards}
        </div>`;
    }).join('');
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

    return `
    <div class="violation">
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
    // Store raw prompt text and file names keyed by panel index
    const rawPrompts = {};
    const fileNames  = {};

    document.querySelectorAll('.prompt-body').forEach(el => {
        rawPrompts[el.id.split('-')[1]] = el.textContent;
    });

    document.querySelectorAll('.panel').forEach(panel => {
        const fp = panel.querySelector('.panel-filepath');
        if (fp) fileNames[panel.dataset.index] = fp.textContent;
    });

    // ── Tab switching ──────────────────────────────────────────────

    function switchTab(index) {
        document.querySelectorAll('.file-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        document.querySelector('.file-tab[data-index="' + index + '"]').classList.add('active');
        document.querySelector('.panel[data-index="' + index + '"]').classList.add('active');
    }

    // ── Copy helper ────────────────────────────────────────────────

    function doCopy(text, btn, originalLabel) {
        const restore = () => { btn.textContent = originalLabel; btn.classList.remove('copied'); };
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