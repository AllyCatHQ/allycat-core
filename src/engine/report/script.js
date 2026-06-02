/**
 * Report Script
 *
 * Returns the client-side JavaScript string embedded in the self-contained HTML report.
 * Handles: theme toggle, tab switching, sidebar file search,
 * impact + WCAG filtering (per panel), copy-to-clipboard, and modal logic.
 *
 * @module engine/report/script
 */

export function buildScript() {
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
        const toggle = document.getElementById('theme-toggle');
        if (toggle) toggle.setAttribute('aria-label', theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    }

    // ── Tab switching ──────────────────────────────────────────────

    function switchTab(index) {
        document.querySelectorAll('.file-tab').forEach(t => {
            t.classList.remove('active');
            t.removeAttribute('aria-current');
        });
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
        const tab = document.querySelector('.file-tab[data-index="' + index + '"]');
        const panel = document.querySelector('.panel[data-index="' + index + '"]');
        if (tab)   { tab.classList.add('active'); tab.setAttribute('aria-current', 'true'); }
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
                const isActive = btn.dataset.filter === value;
                btn.classList.toggle('active', isActive);
                btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
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
    let _modalTrigger     = null;

    function openModal(index) {
        const text = rawPrompts[String(index)] || '';
        document.getElementById('modal-body').textContent     = text;
        document.getElementById('modal-filepath').textContent = fileNames[String(index)] || '';

        const copyBtn = document.getElementById('modal-copy-btn');
        copyBtn.textContent = 'Copy Prompt';
        copyBtn.classList.remove('copied');

        _modalTrigger     = document.activeElement;
        currentModalIndex = index;
        document.getElementById('modal-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
        copyBtn.focus();
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.remove('open');
        document.body.style.overflow = '';
        currentModalIndex = null;
        if (_modalTrigger) { _modalTrigger.focus(); _modalTrigger = null; }
    }

    function closeModalOnOverlay(e) {
        if (e.target === document.getElementById('modal-overlay')) closeModal();
    }

    function copyModalPrompt(btn) {
        if (currentModalIndex === null) return;
        doCopy(rawPrompts[String(currentModalIndex)] || '', btn, 'Copy Prompt');
    }

    // Focus trap: keep keyboard focus inside the modal while it is open
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeModal(); return; }

        const overlay = document.getElementById('modal-overlay');
        if (e.key !== 'Tab' || !overlay.classList.contains('open')) return;

        const focusable = [...overlay.querySelector('.modal').querySelectorAll(
            'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])'
        )].filter(el => !el.closest('[hidden]') && el.offsetParent !== null);

        if (focusable.length === 0) return;
        const first = focusable[0];
        const last  = focusable[focusable.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
            if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
        }
    });
    `;
}
