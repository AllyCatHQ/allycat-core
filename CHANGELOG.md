# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- **WCAG 2.2 AA scanning mode** — new `wcag-22-aa` standard option selectable in `allycat init`
  and by setting `"selectedStandard": "wcag-22-aa"` in `allycat.config.json`.
  Uses axe-core tag set `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`. In axe-core v4.11.1
  this adds one additional automated rule over WCAG 2.1 AA: `target-size` (SC 2.5.8 —
  minimum 24×24px touch target). Recommended for new projects targeting the 2025+ standard.

### Fixed
- Removed ghost tag `wcag21aaa` from the WCAG AAA axe-core tag set. The tag does not exist
  in axe-core v4.11.1 (verified against bundled source) and was silently contributing zero
  rules while appearing in code as if it covered something.

### Changed
- AAA mode relabeled from `"Strict Mode (WCAG 2.1 AAA)"` to `"Strict Mode (WCAG AAA, automated rules)"`
  in the `allycat init` wizard and from `"WCAG 2.1 AAA"` to `"WCAG AAA (automated rules)"` in
  constants, reports, and all help text. The previous label overstated coverage — there are no
  WCAG-2.1-specific AAA rules in axe-core. The tool automates 2 of 3 general AAA rules
  (contrast-enhanced is suppressed in quick mode where JSDOM cannot compute real styles).
  Full AAA conformance always requires a manual audit alongside automated tooling.

---

## [1.3.0] - 2026-06-04

### Added
- `--exclude` auto-scoping — when scanning a scoped path (e.g. `allycat scan scripts`),
  plain names in `--exclude` are automatically resolved relative to that target.
  No need to type the full path: `--exclude test.html` becomes `scripts/test.html`,
  `--exclude fixtures` becomes `scripts/fixtures`, etc.
- `configVersion` field in `allycat.config.json` — the tool now stamps a schema version
  into every config file written by `allycat init`. On each run, the version is checked
  and the config is automatically migrated if it is behind the current format. Users do
  not need to do anything — migration is silent and non-destructive. Protects against
  silent fallback-to-defaults when a global install is updated and the local config
  format has changed.

### Fixed
- Watch mode now applies the same scoped excludes for real-time file-change filtering.
  Previously, excluded files could still trigger a rescan because the watcher was using
  the original unscoped paths instead of the resolved ones.
- Config files containing invalid JSON now produce a clear error message with the file
  path instead of a raw Node.js stack trace. The tool falls back to defaults so the
  scan still runs.

---

## [1.2.1] - 2026-06-04

### Fixed
- `playwright` and `@axe-core/playwright` moved from `devDependencies` to `dependencies` — `allycat scan --full` now works correctly after a global install (`npm install -g allycat`) without requiring users to separately install the playwright npm package.

---

## [1.2.0] - 2026-06-04

### Added
- `--exclude <path>` flag — exclude paths and glob patterns from the scan (repeatable).
  Stacks on top of built-in ignores (node_modules, dist, build). Works in normal scan and watch mode.
- Update notifier — users running an outdated global install now see a banner prompting them to upgrade (`npm i -g allycat`).

---

## [1.1.0] - 2026-06-03

### Added
- `ai.reportBehavior` config option — controls how the fix-prompt report is delivered after each scan: `auto-open` (opens in browser), `path-only` (prints relative + absolute path to terminal), `ask` (prompts each time). Defaults to `path-only` on upgrade so existing installs never get a surprise browser open.
- `allycat init` now includes a 3-choice delivery question (shown when AI fix prompts are enabled)

### Fixed
- `--fail-on-*` exit codes were bypassed in non-interactive environments (CI, piped stdin) when `ai.reportBehavior` was set to `ask` — `@clack/prompts` was calling `process.exit(0)` before the exit gate logic ran. Added a `process.stdin.isTTY` guard to fall back to `path-only` in non-interactive contexts.

### Changed
- **Fix prompts** — renamed from "AI fix suggestions" to "fix prompts for your AI agent" for clearer intent
- **RTL** is now a standalone opt-in feature (`rules.rtl: true` in `allycat.config.json`), decoupled from any accessibility standard. Works for Hebrew, Arabic, Persian, and all other RTL languages. Violation rule ID renamed from `israel-rtl` → `rtl-direction`.

### Removed
- **Israeli Standard IS 5568** removed as a selectable accessibility standard. The standard caused naming friction and generated false positives on bilingual pages (ISSUE-008). RTL checking has been promoted to a standalone, language-agnostic opt-in feature independent of any regional standard. See `docs/archived/israeli-standard-is5568.md` for the full history and a step-by-step revival guide.

---

## [1.0.0] - 2026-03-29

### Added

#### Scanners
- **Quick scanner** — JSDOM-based, ~1s per file, no browser required, concurrency auto-computed from RAM and CPU
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
- `--json-file [filename]` flag — save violations as JSON to a file (auto-named if no filename given); use `-o json` for JSON to stdout
- `--changed <scope>` flag — scan only files changed since last git commit
- `--fail-on-critical` — exit code 1 if any critical violations found
- `--fail-on-serious` — exit code 2 if any serious violations found
- `--fail-on-any` — exit code 3 if any violations found

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
