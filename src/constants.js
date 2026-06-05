// ─── Config & File Names ──────────────────────────────────────────────────────

export const CONFIG_FILE_NAME  = 'allycat.config.json';
export const BASELINE_FILE     = 'allycat-baseline.json';
export const DEFAULT_REPORT_NAME = 'allycat-report';

// Bump ONLY when allycat.config.json schema changes (not on every release).
// Add a migration case in migrateConfig() in src/utils/configLoader.js.
export const CURRENT_CONFIG_VERSION = 1;

// ─── CLI Command Strings ──────────────────────────────────────────────────────

export const CLI = {
    NAME: 'allycat',
    SCAN: 'allycat scan',
    INIT: 'allycat init',
    HELP: 'allycat help',
};

// ─── Scan Modes ───────────────────────────────────────────────────────────────

export const SCAN_MODES = {
    QUICK: 'quick',
    FULL: 'full',
};

// ─── Accessibility Standards ──────────────────────────────────────────────────

export const STANDARDS = {
    WCAG_AA:    'wcag-aa',
    WCAG_AAA:   'wcag-aaa',
    WCAG_22_AA: 'wcag-22-aa',
};

// ─── UI Strings ───────────────────────────────────────────────────────────────

export const UI = {
    DIVIDER:             '─'.repeat(60),
    INTRO_SCAN:          ' 🐾 AllyCat Scan ',
    INTRO_SETUP:         ' 🐾 AllyCat Setup ',
    SCAN_LABEL_FULL:     'Full (with contrast)',
    SCAN_LABEL_QUICK:    'Quick (no contrast)',
    SCAN_LABEL_QUICK_FAST: 'Quick (fast)',
};

// ─── Install Commands ─────────────────────────────────────────────────────────
// These appear verbatim in both scan.js (error hints) and helpContent.js (FAQ).

export const INSTALL = {
    PLAYWRIGHT_GLOBAL: 'npm install -g playwright @axe-core/playwright',
    PLAYWRIGHT_LOCAL:  'npm install playwright @axe-core/playwright',
    CHROMIUM:          'npx playwright install chromium',
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export const MESSAGES = {
    NO_CONFIG:           'No configuration found — starting first-time setup...',
    USING_DEFAULT_CONFIG: 'No config file found — using defaults (WCAG 2.1 AA, Quick mode).\n  Run `allycat init` to customize for this project.',
    SCAN_CANCELLED:      'Scan cancelled — no configuration available.',
    SETUP_CANCELLED:     'Setup cancelled.',
    SETUP_ABORTED:       'Setup aborted.',
    CONFIG_DELETED:      'Configuration deleted. Built-in defaults will be used from now on.',
    ANALYZING:           'Analyzing source files...',
    ANALYSIS_COMPLETE:   'Analysis Complete.',
    ANALYSIS_FAILED:     'Analysis failed.',
    VALID_PATH_REQUIRED: 'Please provide a valid file or directory path.',
    NO_FILES_FOUND:      'No matching files found to scan.',
};

// ─── Standard Display Labels ──────────────────────────────────────────────────
// Human-readable labels used in prompts and reports. Keyed by STANDARDS values.

export const STANDARD_LABELS = {
    [STANDARDS.WCAG_AA]:    'WCAG 2.1 AA',
    [STANDARDS.WCAG_AAA]:   'WCAG AAA (automated rules)',
    [STANDARDS.WCAG_22_AA]: 'WCAG 2.2 AA',
};

// ─── Report File Names ────────────────────────────────────────────────────────

export const DEFAULT_HTML_REPORT = 'allycat-report.html';

// ─── Scan Ignore Patterns ─────────────────────────────────────────────────────
// Glob patterns that are always excluded from scanning — never touch these.
// Single source of truth used by fileResolver and watchMode.
// Add new entries here; both scanners and watch mode pick them up automatically.

export const NEVER_SCAN = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    `**/${DEFAULT_HTML_REPORT}`,
];

// ─── AI Report Delivery Behaviors ─────────────────────────────────────────────

export const AI_REPORT_BEHAVIORS = {
    AUTO_OPEN:  'auto-open',
    PATH_ONLY:  'path-only',
    ASK:        'ask',
};

// ─── Supported File Extensions ────────────────────────────────────────────────
// Single source of truth for all file types the scanner accepts.
// Used by fileResolver, scan display, watchMode, and helpContent.

export const SUPPORTED_EXTENSIONS = ['html', 'htm', 'jsx', 'tsx', 'vue', 'component.ts'];

// Pre-formatted display string derived from the array above — always in sync.
export const SUPPORTED_EXTENSIONS_DISPLAY = SUPPORTED_EXTENSIONS.map(e => `.${e}`).join(' ');

// ─── Supported Frameworks ─────────────────────────────────────────────────────
// Structured list of framework → extensions used in help FAQ and init wizard.
// Each consumer applies its own chalk styling.

export const SUPPORTED_FRAMEWORKS = [
    { label: 'HTML',    extensions: ['.html', '.htm'] },
    { label: 'React',   extensions: ['.jsx', '.tsx'] },
    { label: 'Vue',     extensions: ['.vue'] },
    { label: 'Angular', extensions: ['.component.html', '.component.ts'] },
];

// ─── Impact Severity Order ────────────────────────────────────────────────────
// Shared sort key: lower value = more severe. Used by watchMode and violationFormatter.

export const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };

// ─── App Links ────────────────────────────────────────────────────────────────

export const APP_LINKS = {
    DOCS: 'https://github.com/AllyCatHQ/allycat-core/blob/main/README.md',
};
