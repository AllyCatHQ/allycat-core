<p align="center">
  <img src="assets/icon.png" alt="AllyCat logo" width="200" />
</p>

# AllyCat

[![CI](https://github.com/AllyCatHQ/allycat-core/actions/workflows/ci.yml/badge.svg)](https://github.com/AllyCatHQ/allycat-core/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue.svg)](https://www.npmjs.com/package/allycat)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> The accessibility tool that works the way developers work — terminal, watch mode, CI gates, and AI fix prompts in one.

**No server needed** · **Source files** · **Exact line numbers** · **JSX/TSX · Vue · Angular · HTML**

<p align="center">
  <img src="assets/demo.gif" alt="AllyCat scanning files — violations found and reported" />
</p>

---

## Features

| Feature | Description |
|---|---|
| 🚀 Quick Scan | JSDOM-based scanning — no browser needed, results in ~1s |
| 🔍 Full Scan | Playwright-based with real browser rendering and contrast checking |
| 🇮🇱 Israeli Standard | Built-in IS 5568 compliance with mandatory RTL support |
| 📍 Precise Locations | Exact line numbers with clickable VS Code file links |
| 📊 Multiple Outputs | Terminal, JSON (stdout), and JSON file export |
| 🤖 AI Report | Auto-generated HTML report with per-file AI fix prompts |
| ⚡ CI/CD Ready | Exit gates, JSON export, and git-diff scoping for pipelines |
| ⚙️ Parallel Scanning | Auto-computed from RAM + CPU — no manual tuning needed |
| 📖 Built-in Help | FAQ, examples, CI guides, and standards explained |

---

## Why AllyCat vs `@axe-core/cli`?

`@axe-core/cli` (by Deque Labs) is the authoritative tool for **scanning live URLs**.
AllyCat is built for a different scenario: scanning **source files before the app runs**.

| | AllyCat | @axe-core/cli |
|---|---|---|
| Needs a running server? | **No** — scans source files directly | Yes — requires a URL |
| JSX / TSX support? | **Yes** — Babel transformer | No |
| Vue SFC support? | **Yes** — Vue compiler | No |
| Angular template support? | **Yes** — inline + external | No |
| Exact source line numbers? | **Yes** — clickable VSCode links | No — DOM selector only |
| Watch mode (NEW/FIXED deltas)? | **Yes** | No |
| Scan only git-changed files? | **Yes** (`--changed`) | No |
| Israeli Standard IS 5568? | **Yes** | No |
| RTL / BiDi validation? | **Yes** | No |
| AI fix prompts (HTML report)? | **Yes** | No |
| Quick scan (no browser)? | **Yes** — JSDOM, ~1s/file | No — always full browser |

**Use AllyCat when:** you want a11y checks in pre-commit hooks, PR pipelines without
a deployed environment, or editor-integrated watch mode.

**Use `@axe-core/cli` when:** you need to scan a deployed URL or a page that requires
full JavaScript execution to render dynamic content.

---

## Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

> Full scan mode (contrast checking) requires a Chromium browser — download it once with `npx playwright install chromium`.

---

## Installation

```bash
npm install -g allycat
```

For full scan mode (contrast checking), download the Chromium browser once:

```bash
npx playwright install chromium
```

> Playwright is included with AllyCat — no separate `npm install` needed.

---

## Quick Start

```bash
# 1. Initialize configuration
allycat init

# 2. Scan your project
allycat scan

# 3. Scan a specific folder or file
allycat scan ./src
allycat scan ./src/components/Button.tsx
```

---

## Commands

### `allycat init`

Interactive setup wizard. Creates `allycat.config.json` in your project root.

```bash
allycat init
```

Prompts for:
- Accessibility standard (WCAG AA, WCAG AAA, Israeli IS 5568)
- RTL support (auto-enabled for Israeli standard)
- Default scan mode (quick or full)
- AI-powered fix suggestions (enabled/disabled)

> No framework selection is required. The scanner automatically detects `.html`, `.jsx`, `.tsx`, `.vue`, and Angular `.component.html` / `.component.ts` files.

---

### `allycat scan [target]`

Scan files for accessibility violations.

```bash
# Scan entire project (uses config defaults)
allycat scan

# Scan specific directory
allycat scan ./src

# Scan specific file
allycat scan ./src/pages/Home.tsx
```

#### Options

| Option | Short | Description |
|---|---|---|
| `--quick` | `-q` | Quick scan — fast, skips contrast check |
| `--full` | `-f` | Full scan — includes contrast check via Playwright |
| `--summary` | `-s` | Show violation counts only, no details |
| `--output <format>` | `-o` | Output format: `terminal` (default) or `json` |
| `--json-file [name]` | `-j` | Save report to a JSON file |
| `--fail-on-critical` | | Exit code 1 if any critical violations found |
| `--fail-on-serious` | | Exit code 2 if any serious or critical violations found |
| `--fail-on-any` | | Exit code 3 if any violations found (strictest gate) |
| `--save-baseline` | | Snapshot all current violations to `allycat-baseline.json` — exits 0 always |
| `--fail-on-new` | | Exit code 4 if any violation is not in the saved baseline |
| `--changed` | `-c` | Scan only files changed since the last git commit |
| `--watch` | `-w` | Watch for file changes and re-scan automatically |
| `--existing` | `-e` | In watch mode: show full details of pre-existing violations on startup (default: counts only) |

#### Examples

```bash
# Quick scan (default mode)
allycat scan

# Full scan with contrast checking
allycat scan --full

# Summary only — just violation counts
allycat scan --summary

# JSON to terminal (pipe-friendly)
allycat scan -o json

# Save JSON report — auto-generated filename
allycat scan --json-file
# → allycat-report-2025-05-27-143052.json

# Save JSON report — custom filename
allycat scan --json-file my-report
# → my-report.json

# Scan only git-changed files (great for pre-commit hooks)
allycat scan --changed

# Scan changed files scoped to a directory
allycat scan --changed ./src

# Watch mode — auto re-scans on every file save (pre-existing shown as counts only)
allycat scan --watch
allycat scan --watch ./src
# Watch mode — show full details of pre-existing violations on startup
allycat scan --watch --existing

# After each save, watch mode shows a delta:
#   [NEW]   — violation appeared since the last scan
#   [FIXED] — violation was present before and is now resolved
# Violations with no label are unchanged since the last scan.

# Block CI pipeline on critical violations and save report
allycat scan --fail-on-critical --json-file ci-report

# Strictest CI gate — block on any violation
allycat scan --fail-on-any --json-file ci-report
```

---

### `allycat help [topic]`

Access built-in documentation, FAQ, and examples.

```bash
# List all help topics
allycat help

# Specific topics
allycat help faq        # Common questions and answers
allycat help examples   # Real-world usage examples
allycat help ci         # CI/CD integration guide
allycat help standards  # Standards explained (WCAG vs Israeli)
```

#### Command-specific help

```bash
allycat --help        # All commands overview
allycat init --help   # Init command details
allycat scan --help   # Scan command with all options
```

---

## Configuration

Running `allycat init` creates `allycat.config.json` in your project root. You can also edit it manually.

```json
{
  "selectedStandard": "wcag-aa",
  "rules": {
    "rtl": false,
    "level": "AA"
  },
  "scan": {
    "defaultMode": "quick"
  },
  "ai": {
    "enabled": true
  },
  "performance": {
    "concurrency": null
  }
}
```

### Configuration Reference

| Option | Values | Description |
|---|---|---|
| `selectedStandard` | `wcag-aa`, `wcag-aaa`, `israel` | Accessibility ruleset to enforce |
| `rules.rtl` | `true`, `false` | Enable RTL direction checking |
| `rules.level` | `AA`, `AAA` | WCAG conformance level |
| `scan.defaultMode` | `quick`, `full` | Default scan mode when no flag is passed |
| `ai.enabled` | `true`, `false` | Generate HTML report with AI fix prompts after each scan |
| `performance.concurrency` | integer or `null` (default: `null`) | Files to scan in parallel. `null` = Auto (computed from RAM + CPU). Configure via `allycat init` |

---

## Supported File Types

No framework configuration is required. AllyCat automatically scans all matching files found in your project:

| File Type | Extension | Notes |
|---|---|---|
| HTML | `.html`, `.htm` | Scanned natively |
| React / TSX | `.jsx`, `.tsx` | Transformed to HTML before scanning |
| Vue | `.vue` | Single-file components — template extracted and scanned |
| Angular | `.component.html` | External Angular templates — scanned natively |
| Angular (inline) | `.component.ts` | Inline templates extracted from `template:` and scanned |

> Files inside `node_modules/`, `dist/`, and `build/` are always ignored.

---

## Parallel Scanning & Performance

AllyCat scans multiple files concurrently. By default, the parallel limit is computed automatically from your machine's RAM and CPU — no manual tuning needed.

**Formula:**
- Quick mode: `min(60% RAM ÷ 200 MB, CPU cores × 4)`
- Full mode: `min(60% RAM ÷ 500 MB, CPU cores × 4, 8)` — capped at 8 due to Playwright CPU overhead

**Example ceilings by machine:**

| RAM | Cores | Quick limit | Full limit |
|-----|-------|-------------|------------|
| 4 GB | 4 | 12 | 4 |
| 8 GB | 8 | 24 | 8 |
| 16 GB | 8 | 32 | 8 |
| 32 GB | 16 | 64 | 8 |

The resolved limit is shown in the scan panel on every run:
```
│ Parallel:  Auto → 24 files
```

To override, run `allycat init`, enable **advanced options**, and choose a preset or enter a custom value. If your value exceeds the safe ceiling, AllyCat will warn and ask for confirmation before saving.

If you set a value manually and it exceeds the safe ceiling at scan time, it is clamped automatically with a warning:
```
[allycat] performance.concurrency "40" exceeds safe limit for your system
in quick mode. Clamped to 24.
```

---

## Accessibility Standards

| Standard | Contrast Ratio | RTL Required | Typical Use |
|---|---|---|---|
| WCAG 2.1 AA | 4.5:1 | No | Most websites |
| WCAG 2.1 AAA | 7:1 | No | Government / Medical |
| Israeli IS 5568 | 4.5:1 | **Yes** | Israeli websites (legally required) |

> Run `allycat help standards` for a full breakdown.

---

## Output Formats

### Terminal (Default)

Color-coded, grouped by file, with clickable VS Code file links:

```
src/components/Button.tsx
3 issues

  CRITICAL  Ensure buttons have discernible text
   Rule:    button-name
   File:    src/components/Button.tsx:14
   Element: button
   HTML:    <button onclick="..."></button>
   WCAG:    wcag2a, wcag412

✖ Found 3 violations in 1 file
   1 critical, 2 moderate
   (use --full for contrast checking)
```

### JSON Output

For programmatic consumption or CI/CD integration:

```bash
# Print to terminal
allycat scan -o json

# Save to file (recommended for CI)
allycat scan --json-file report
```

JSON structure:

```json
{
  "timestamp": "2025-05-27T14:30:52.123Z",
  "scanMode": "quick",
  "standard": "wcag-aa",
  "rtlEnabled": false,
  "contrastChecked": false,
  "totalViolations": 3,
  "summary": {
    "critical": 1,
    "serious": 0,
    "moderate": 2,
    "minor": 0
  },
  "byFile": {
    "src/components/Button.tsx": {
      "count": 3,
      "critical": 1,
      "serious": 0
    }
  },
  "violations": [...]
}
```

### AI Report (HTML)

When `ai.enabled` is `true` in your config, AllyCat automatically generates a self-contained HTML report after every terminal scan and opens it in your default browser.

The report includes:
- All violations grouped by file with severity badges
- Per-file copy-paste AI fix prompts (ready to paste into any AI agent)
- Impact filter bar (All / Critical / Serious / Moderate / Minor)
- Sidebar file search
- Light / dark mode toggle

### Summary Mode

Minimal output for quick CI log checks:

```bash
allycat scan --summary
# → ✖ Found 3 violations in 1 file — 1 critical, 2 moderate
```

---

## CI/CD Integration

### Exit Codes

| Code | Flag | Meaning |
|---|---|---|
| `0` | — | Scan completed — no threshold flag used, or threshold not met |
| `1` | `--fail-on-critical` | Critical violations found |
| `2` | `--fail-on-serious` | Serious or critical violations found |
| `3` | `--fail-on-any` | Any violations found (strictest gate) |
| `4` | `--fail-on-new` | New violation found that was not in the saved baseline |

Use exit gate flags to control when the pipeline fails:

```bash
# Block only on critical violations (loosest gate)
allycat scan --fail-on-critical

# Block on serious or critical violations
allycat scan --fail-on-serious

# Block on any violation (strictest gate)
allycat scan --fail-on-any
```

### Violation Baseline

Adopt a CI gate immediately — without fixing every pre-existing violation first.

**Day 1 — snapshot what exists today:**

```bash
allycat scan --save-baseline
# Creates allycat-baseline.json — commit this file to your repository
```

**Every CI run — only fail on NEW violations:**

```bash
allycat scan --fail-on-new
# Exit 0 if all violations were in the baseline (even if count is high)
# Exit 4 if any violation is NOT in the baseline (new regression)
```

**After fixing violations — update the baseline:**

```bash
allycat scan --save-baseline
# Re-runs the snapshot; stale entries (fixed violations) are removed automatically
```

**Combine with severity gates:**

```bash
allycat scan --fail-on-new --fail-on-critical
# Exit 4 if new violations exist; exit 1 if critical baseline violations exist
```

> Matching uses a composite key: file + rule + SHA-256(element HTML) + CSS selector.
> No line numbers — stable across any edit that doesn't touch the element itself.

---

### GitHub Actions

```yaml
name: Accessibility Check

on: [push, pull_request]

jobs:
  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install AllyCat
        run: npm install -g allycat

      - name: Run accessibility scan
        run: allycat scan --fail-on-critical --json-file allycat-report

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: accessibility-report
          path: allycat-report.json
```

### GitLab CI

```yaml
accessibility:
  image: node:20
  script:
    - npm ci
    - npm install -g allycat
    - allycat scan --fail-on-critical --json-file allycat-report
  artifacts:
    paths:
      - allycat-report.json
```

### Jenkins

```groovy
stage('Accessibility') {
  steps {
    sh 'npm install -g allycat'
    sh 'allycat scan --fail-on-critical --json-file allycat-report'
    archiveArtifacts artifacts: 'allycat-report.json'
  }
}
```

> Run `allycat help ci` for more CI/CD examples.

---

## Path Handling

AllyCat is cross-platform. Forward slashes and backslashes are both supported:

```bash
# All of these work on any OS
allycat scan ./src
allycat scan .\src
allycat scan src/components
allycat scan src\components
```

---

## Troubleshooting

**"No configuration found"**
Run `allycat init` to create `allycat.config.json`.

**Full scan fails — Chromium not found**
Download the browser once:
```bash
npx playwright install chromium
```

**Contrast not checked in quick mode**
Contrast requires a real browser. Use `--full`:
```bash
allycat scan --full
```

**Files not being scanned**
Check that files are not inside `node_modules/`, `dist/`, or `build/`, and that they use a supported extension (`.html`, `.htm`, `.jsx`, `.tsx`, `.vue`, `.component.html`, `.component.ts`).

**`--changed` returns an error**
`--changed` requires git and at least two commits. Run from inside a git repository.

> Run `allycat help faq` for a full list of common questions.

---

## Project Structure

```
allycat/
├── src/
│   ├── index.js                       # CLI entry point & command definitions
│   ├── constants.js                   # Shared constants
│   ├── commands/
│   │   ├── init.js                    # `init` command
│   │   ├── scan.js                    # `scan` orchestrator (config + mode selection)
│   │   ├── scanDispatcher.js          # Input resolution & scanner selection
│   │   ├── scanResultHandler.js       # Output routing & CI exit code enforcement
│   │   ├── watchMode.js               # `--watch` file watcher with NEW/FIXED delta labels
│   │   ├── watchOutputter.js          # Watch mode output formatting
│   │   ├── watchState.js              # Watch mode state management
│   │   ├── scanOutputters.js          # Output routing (terminal, JSON, AI report)
│   │   ├── help.js                    # `help` command
│   │   └── helpContent.js             # FAQ, examples, CI snippets
│   ├── engine/
│   │   ├── scanners/
│   │   │   ├── quickScanner.js        # JSDOM-based scanner (parallel, p-limit)
│   │   │   └── fullScanner.js         # Playwright-based scanner
│   │   ├── transformers/
│   │   │   ├── jsxTransformer.js      # JSX/TSX → HTML transformer (Babel)
│   │   │   ├── vueTransformer.js      # Vue SFC → HTML transformer
│   │   │   ├── angularTransformer.js  # Angular .component.html transformer
│   │   │   ├── angularTsExtractor.js  # Angular inline template extractor
│   │   │   └── transformerUtils.js    # Shared transformer utilities
│   │   └── report/
│   │       ├── generator.js           # HTML report entry point
│   │       ├── html.js                # HTML assembly
│   │       ├── styles.js              # Report CSS
│   │       ├── script.js              # Report client-side JS
│   │       └── promptGenerator.js     # AI fix prompt builder
│   └── utils/
│       ├── configLoader.js            # Config load, save, RAM-aware concurrency clamping
│       ├── fileResolver.js            # File discovery & extension filtering
│       ├── fileUtils.js               # BOM-aware file reading (UTF-16 + UTF-8)
│       ├── pathUtils.js               # Cross-platform path normalization
│       ├── sourceMapper.js            # Line number detection
│       ├── violationFormatter.js      # Output formatting & grouping
│       ├── violationProcessor.js      # axe-core result → violation objects
│       ├── axeConfig.js               # axe-core tag list per standard
│       ├── rtlValidator.js            # RTL compliance checks (HTML & JSX)
│       ├── cssResolver.js             # CSS extraction & injection for full scan
│       └── browserOpener.js           # Cross-platform browser launch
├── tests/
│   ├── e2e/                           # End-to-end CLI tests
│   └── samples/                       # Test HTML/JSX fixtures
├── allycat.config.json                # Project configuration (user-generated)
├── package.json
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## Roadmap

Features planned or in progress:

- **`--report` flag** — Expose the HTML report as a standalone CLI flag (`allycat scan --report`) so it can be generated without enabling `ai.enabled` in config.
- **UI preferences** — Per-project control over summary style and which violation fields are shown in terminal output, configurable via `allycat init ui`.
- **Config validation** — Warn on unknown or misspelled keys in `allycat.config.json` instead of silently falling back to defaults.

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before submitting a pull request.

---

## Acknowledgments

- [axe-core](https://github.com/dequelabs/axe-core) — Accessibility rules engine
- [Playwright](https://playwright.dev/) — Browser automation for full scan mode
- [JSDOM](https://github.com/jsdom/jsdom) — DOM implementation for quick scan mode
- [Babel](https://babeljs.io/) — JSX/TSX transformation
- [Commander.js](https://github.com/tj/commander.js) — CLI framework

---

## License

MIT
