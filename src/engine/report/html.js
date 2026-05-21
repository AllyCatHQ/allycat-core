/**
 * Report HTML Builders
 *
 * Assembles the full HTML document and all its sections for the AllyCat report.
 * Consumes CSS from styles and client-side JS from script.
 *
 * @module engine/report/html
 */

import path from 'path';
import { buildStyles } from './styles.js';
import { buildScript } from './script.js';
import { countByImpact } from '../../utils/violationFormatter.js';
import { STANDARD_LABELS, STANDARDS } from '../../constants.js';

// -----------------------------------------------------------------------------
// Data Helpers
// -----------------------------------------------------------------------------

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
    return STANDARD_LABELS[standard] || STANDARD_LABELS[STANDARDS.WCAG_AA];
}

// -----------------------------------------------------------------------------
// HTML Entry
// -----------------------------------------------------------------------------

export function buildHtml(byFile, prompts, config, scanMode) {
    const files     = Object.keys(byFile);
    const timestamp = new Date().toLocaleString();
    const standard  = resolveStandardLabel(config?.selectedStandard);
    const promptMap = Object.fromEntries(prompts.map(p => [p.file, p.prompt]));

    return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AllyCat Report</title>
<style>${buildStyles()}</style>
</head>
<body>
${buildHeader(byFile, standard, scanMode, timestamp)}
<div class="layout">
${buildSidebar(files, byFile)}
<main class="content" id="content">
${buildPanels(files, byFile, promptMap)}
</main>
</div>
${buildModal()}
<script>${buildScript()}</script>
</body>
</html>`;
}

// -----------------------------------------------------------------------------
// Section Builders
// -----------------------------------------------------------------------------

function buildHeader(byFile, standard, scanMode, timestamp) {
    const all    = Object.values(byFile).flat();
    const counts = countByImpact(all);
    const files  = Object.keys(byFile).length;

    return `
<header class="header">
    <div class="header-brand">
        <img class="brand-icon" src="https://raw.githubusercontent.com/AllyCatHQ/allycat-core/main/assets/icon-face.png" alt="AllyCat" />
        <div>
            <h1 class="brand-name">AllyCat</h1>
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
        <button class="theme-toggle" id="theme-toggle" onclick="toggleTheme()" aria-label="Switch to light mode">
            <svg class="icon-moon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
            <svg class="icon-sun" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
        </button>
        <div class="header-meta">
            <div>Standard: ${escapeHtml(standard)}</div>
            <div>Mode: ${scanMode === 'full' ? 'Full (contrast)' : 'Quick'}</div>
            <div>${escapeHtml(timestamp)}</div>
        </div>
    </div>
</header>`;
}

function buildSidebar(files, byFile) {
    const tabs = files.map((file, i) => {
        const count = byFile[file].length;
        const name  = path.basename(file);
        const dir   = path.dirname(file);
        return `
        <div role="button" tabindex="0" class="file-tab ${i === 0 ? 'active' : ''}" onclick="switchTab(${i})" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();switchTab(${i})}" data-index="${i}" data-filename="${escapeHtml(name.toLowerCase())}" aria-current="${i === 0 ? 'true' : 'false'}">
            <div class="file-tab-name">${escapeHtml(name)}</div>
            <div class="file-tab-path">${escapeHtml(dir)}</div>
            <span class="file-tab-badge">${count}</span>
        </div>`;
    }).join('');

    return `
    <nav class="sidebar" aria-label="File navigation">
        <div class="sidebar-search-wrap">
            <input
                class="sidebar-search"
                id="sidebar-search"
                type="text"
                placeholder="Filter files…"
                aria-label="Filter files"
                oninput="filterSidebar(this.value)"
                autocomplete="off"
                spellcheck="false"
            />
        </div>
        <div class="sidebar-label">Files</div>
        <div class="sidebar-files" id="sidebar-files">
            ${tabs}
        </div>
        <div class="sidebar-empty" id="sidebar-empty" role="status" aria-live="polite">No files match</div>
    </nav>`;
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
                    <button class="expand-pill" onclick="openModal(${i})" aria-label="Open full prompt in a modal view">⛶ Full View</button>
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
            <div class="no-results" id="no-results-${i}" role="status" aria-live="polite">No violations match this filter</div>
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
            <button class="filter-btn active" data-filter="all" data-filter-type="impact" aria-pressed="true" onclick="filterPanel(${panelIndex}, 'all', 'impact', this)">
                All<span class="filter-count">${total}</span>
            </button>
            ${levels.map(l => `
            <button class="filter-btn" data-filter="${l.key}" data-filter-type="impact" aria-pressed="false" onclick="filterPanel(${panelIndex}, '${l.key}', 'impact', this)">
                ${l.label}<span class="filter-count">${counts[l.key]}</span>
            </button>`).join('')}
        </div>` : '';

    const wcagRow = showWcag ? `
        <div class="filter-row">
            <span class="filter-label">WCAG:</span>
            <button class="filter-btn active" data-filter="all" data-filter-type="wcag" aria-pressed="true" onclick="filterPanel(${panelIndex}, 'all', 'wcag', this)">
                All<span class="filter-count">${total}</span>
            </button>
            ${wcagTags.map(({ tag, count }) => `
            <button class="filter-btn" data-filter="${escapeHtml(tag)}" data-filter-type="wcag" aria-pressed="false" onclick="filterPanel(${panelIndex}, '${escapeHtml(tag)}', 'wcag', this)">
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
                <button class="expand-btn" aria-label="Open full prompt in a readable view" onclick="openModal(${index})">⛶</button>
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
                    ? ` <a class="help-link" href="${escapeHtml(v.helpUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Learn more about this rule (opens in new tab)">Learn more ↗</a>`
                    : ''}</div>
            </div>
        </div>
    </div>`;
}

function buildModal() {
    return `
<div class="modal-overlay" id="modal-overlay" onclick="closeModalOnOverlay(event)">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-header">
            <div>
                <div class="modal-title" id="modal-title"><span>✦</span> AI Fix Prompt</div>
                <div class="modal-filepath" id="modal-filepath"></div>
            </div>
            <div class="modal-actions">
                <button class="modal-copy-btn" id="modal-copy-btn" onclick="copyModalPrompt(this)">Copy Prompt</button>
                <button class="modal-close" onclick="closeModal()" aria-label="Close modal">✕</button>
            </div>
        </div>
        <div class="modal-body" id="modal-body"></div>
    </div>
</div>`;
}
