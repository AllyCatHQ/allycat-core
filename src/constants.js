// ─── Config & File Names ──────────────────────────────────────────────────────

export const CONFIG_FILE_NAME = 'a11y-config.json';
export const DEFAULT_REPORT_NAME = 'a11y-report';

// ─── CLI Command Strings ──────────────────────────────────────────────────────

export const CLI = {
    NAME: 'a11y-guard',
    SCAN: 'a11y-guard scan',
    INIT: 'a11y-guard init',
    HELP: 'a11y-guard help',
};

// ─── Scan Modes ───────────────────────────────────────────────────────────────

export const SCAN_MODES = {
    QUICK: 'quick',
    FULL: 'full',
};

// ─── Accessibility Standards ──────────────────────────────────────────────────

export const STANDARDS = {
    WCAG_AA:  'wcag-aa',
    WCAG_AAA: 'wcag-aaa',
    ISRAEL:   'israel',
};

// ─── UI Strings ───────────────────────────────────────────────────────────────

export const UI = {
    DIVIDER:             '─'.repeat(60),
    INTRO_SCAN:          ' A11y-Guard Scan ',
    INTRO_SETUP:         ' A11y-Guard Setup ',
    SCAN_LABEL_FULL:     'Full (with contrast)',
    SCAN_LABEL_QUICK:    'Quick (no contrast)',
    SCAN_LABEL_QUICK_FAST: 'Quick (fast)',
};

// ─── Install Commands ─────────────────────────────────────────────────────────
// These appear verbatim in both scan.js (error hints) and helpContent.js (FAQ).

export const INSTALL = {
    PLAYWRIGHT: 'npm install playwright @axe-core/playwright',
    CHROMIUM:   'npx playwright install chromium',
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const MESSAGES = {
    NO_CONFIG:           'No configuration found — starting first-time setup...',
    SCAN_CANCELLED:      'Scan cancelled — no configuration available.',
    SETUP_CANCELLED:     'Setup cancelled.',
    SETUP_ABORTED:       'Setup aborted.',
    ANALYZING:           'Analyzing source files...',
    ANALYSIS_COMPLETE:   'Analysis Complete.',
    ANALYSIS_FAILED:     'Analysis failed.',
    VALID_PATH_REQUIRED: 'Please provide a valid file or directory path.',
    NO_FILES_FOUND:      'No matching files found to scan.',
};

// ─── Standard Display Labels ──────────────────────────────────────────────────
// Human-readable labels used in prompts and reports. Keyed by STANDARDS values.

export const STANDARD_LABELS = {
    [STANDARDS.WCAG_AA]:  'WCAG 2.1 AA',
    [STANDARDS.WCAG_AAA]: 'WCAG 2.1 AAA',
    [STANDARDS.ISRAEL]:   'Israeli Standard IS 5568 (WCAG 2.1 AA + RTL)',
};

// ─── Report File Names ────────────────────────────────────────────────────────

export const DEFAULT_HTML_REPORT = 'a11y-report.html';

// ─── Supported File Extensions ────────────────────────────────────────────────
// Single source of truth for all file types the scanner accepts.
// Used by fileResolver, scan display, watchMode, and helpContent.

export const SUPPORTED_EXTENSIONS = ['html', 'htm', 'jsx', 'tsx', 'vue', 'component.ts'];

// ─── App Links ────────────────────────────────────────────────────────────────

export const APP_LINKS = {
    DOCS: 'https://github.com/dotcomico/A11yGuard-Core/blob/main/Readme.md',
};
