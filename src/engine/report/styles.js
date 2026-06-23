/**
 * Report Styles
 *
 * Returns the full CSS string embedded in the self-contained HTML report.
 * Includes dark/light theme variables, layout, sidebar, panels,
 * violation cards, modal, and scrollbar styling.
 *
 * @module engine/report/styles
 */

export function buildStyles() {
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
        --text-dim:     #9090a8;
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
        --text-dim:     #707088;
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
        border-radius: 8px;
        flex-shrink: 0;
        object-fit: contain;
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
        background: transparent; color: var(--accent);
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
        background: #5b4de8; color: #fff; border: none;
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

    .vfield-secondary { opacity: 0.6; font-size: 0.85em; }

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
        background: #5b4de8; color: #fff; border: none;
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
