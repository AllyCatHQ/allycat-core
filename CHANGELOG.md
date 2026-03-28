# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-03-15

### Added

#### Scanners
- **Quick scanner** — JSDOM-based, ~1s per file, no browser required, default concurrency 5
- **Full scanner** — Playwright/Chromium-based, full color contrast checking, concurrency capped at 8
- RAM-aware concurrency auto-clamping — safe defaults computed from available system memory
- Per-file error isolation — a single corrupted file logs a warning but does not halt the scan

#### Standards
- WCAG 2.1 Level AA compliance scanning
- WCAG 2.1 Level AAA compliance scanning
- Israeli Standard IS 5568 compliance scanning
- RTL (right-to-left) layout violation detection for Hebrew/Arabic content

#### File Type Support
- HTML and HTM files
- JSX and TSX files via Babel transformer with source line mapping
- Vue single-file components (`.vue`) via `@vue/compiler-dom` transformer
- Angular templates (`.component.html`) via custom Angular transformer
- Angular inline templates (`.component.ts`) via TypeScript extractor

#### CLI
- `allycat scan <target>` — scan a file, directory, or glob pattern
- `allycat init` — interactive setup wizard (standard, scan mode, RTL, AI, concurrency)
- `--full` flag — switch to Playwright/Chromium scanner for contrast checking
- `--watch` flag — watch mode with live re-scan on file save; NEW/FIXED delta labels
- `--summary` flag — compact summary-only output for CI pipelines
- `--json [file]` flag — output violations as JSON (stdout or named file)
- `--changed <scope>` flag — scan only files changed since last git commit
- `--fail-on-critical` — exit code 1 if any critical violations found
- `--fail-on-serious` — exit code 2 if any serious violations found
- `--fail-on-any` — exit code 3 if any violations found
- `--concurrency <n>` — override default file concurrency per run
- `--standard <standard>` — override configured accessibility standard per run

#### Output
- Exact source line numbers for every violation
- Clickable `vscode://` deep-links to open the exact file and line in VS Code
- Self-contained HTML report with dark/light toggle, violation filters, and file search
- AI fix prompt modals in the HTML report — copy a ready-to-use prompt for any violation
- CSS-in-JS detection warning (styled-components, emotion, styled-jsx, stitches)
- BOM-aware file reading — UTF-8 with and without BOM, UTF-16 LE/BE

#### Configuration
- `allycat.config.json` project config — standard, scan mode, RTL, AI, concurrency
- Version read dynamically from `package.json` — `--version` always matches the installed package

#### Baseline (--save-baseline / --fail-on-new)
- `--save-baseline` flag — saves a snapshot of current violations to `allycat-baseline.json`
- `--fail-on-new` flag — exit code 4 if any violations are found that are not in the saved baseline
- Composite fingerprint matching — violations matched by rule ID, file, element tag, and stable DOM path
- Stable canonical selector (`stableSelector`) — deterministic DOM path that survives reordering and duplicate elements
- Terminal output marks suppressed violations as `[BASELINE]` and new violations as `[NEW]`
- `allycat-baseline.json` naming follows the `allycat-` prefix convention alongside `allycat.config.json` and `allycat-report.*`

### Changed

#### Architecture
- Violation processing pipeline unified between quick and full scanner — single code path for line resolution, RTL injection, and output
- `violationProcessor.js` and `rtlValidator.js` moved to `src/engine/violations/` layer for cleaner separation
- `scanOutputters.js` split into focused modules under `src/commands/outputters/` (terminal, summary, JSON, index router)
- `groupByFile` renamed to `countViolationsByFile` to accurately reflect its return shape
- `stripHtmlComments` extracted from `cssResolver` and reused in `vueTransformer` instead of duplicating logic

### Fixed
- Duplicate-element baseline false positives — `stableSelector` now produces a stable canonical DOM path so two identical elements on the same page are matched correctly across baseline runs
- Stale `a11y-config.json` references updated to `allycat.config.json` across CLAUDE.md, test scripts, and all documentation
- Concurrency hard cap corrected from 3 to 8 in E2E concurrency test to match actual scanner behavior
