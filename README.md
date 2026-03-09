# A11y-Guard

> The accessibility tool that works the way developers work — terminal, watch mode, CI gates, and AI fix prompts in one.

Fast, developer-friendly accessibility scanning with support for **WCAG 2.1 AA/AAA** and **Israeli Standard IS 5568**.

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

## Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

> Full scan mode (contrast checking) requires a Chromium browser — download it once with `npx playwright install chromium`.

---

## Installation

```bash
npm install -g a11y-guard
```

For full scan mode (contrast checking), download the Chromium browser once:

```bash
npx playwright install chromium
```

> Playwright is included with A11y-Guard — no separate `npm install` needed.

---

## Quick Start

```bash
# 1. Initialize configuration
a11y-guard init

# 2. Scan your project
a11y-guard scan

# 3. Scan a specific folder or file
a11y-guard scan ./src
a11y-guard scan ./src/components/Button.tsx
```

---

## Commands

### `a11y-guard init`

Interactive setup wizard. Creates `a11y-config.json` in your project root.

```bash
a11y-guard init
```

Prompts for:
- Accessibility standard (WCAG AA, WCAG AAA, Israeli IS 5568)
- RTL support (auto-enabled for Israeli standard)
- Default scan mode (quick or full)
- AI-powered fix suggestions (enabled/disabled)

> No framework selection is required. The scanner automatically detects `.html`, `.jsx`, `.tsx`, `.vue`, and Angular `.component.html` / `.component.ts` files.

---

### `a11y-guard scan [target]`

Scan files for accessibility violations.

```bash
# Scan entire project (uses config defaults)
a11y-guard scan

# Scan specific directory
a11y-guard scan ./src

# Scan specific file
a11y-guard scan ./src/pages/Home.tsx
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
| `--changed` | `-c` | Scan only files changed since the last git commit |
| `--watch` | `-w` | Watch for file changes and re-scan automatically |
| `--existing` | `-e` | In watch mode: show full details of pre-existing violations on startup (default: counts only) |

#### Examples

```bash
# Quick scan (default mode)
a11y-guard scan

# Full scan with contrast checking
a11y-guard scan --full

# Summary only — just violation counts
a11y-guard scan --summary

# JSON to terminal (pipe-friendly)
a11y-guard scan -o json

# Save JSON report — auto-generated filename
a11y-guard scan --json-file
# → a11y-report-2025-05-27-143052.json

# Save JSON report — custom filename
a11y-guard scan --json-file my-report
# → my-report.json

# Scan only git-changed files (great for pre-commit hooks)
a11y-guard scan --changed

# Scan changed files scoped to a directory
a11y-guard scan --changed ./src

# Watch mode — auto re-scans on every file save (pre-existing shown as counts only)
a11y-guard scan --watch
a11y-guard scan --watch ./src
# Watch mode — show full details of pre-existing violations on startup
a11y-guard scan --watch --existing

# After each save, watch mode shows a delta:
#   [NEW]   — violation appeared since the last scan
#   [FIXED] — violation was present before and is now resolved
# Violations with no label are unchanged since the last scan.

# Block CI pipeline on critical violations and save report
a11y-guard scan --fail-on-critical --json-file ci-report

# Strictest CI gate — block on any violation
a11y-guard scan --fail-on-any --json-file ci-report
```

---

### `a11y-guard help [topic]`

Access built-in documentation, FAQ, and examples.

```bash
# List all help topics
a11y-guard help

# Specific topics
a11y-guard help faq        # Common questions and answers
a11y-guard help examples   # Real-world usage examples
a11y-guard help ci         # CI/CD integration guide
a11y-guard help standards  # Standards explained (WCAG vs Israeli)
```

#### Command-specific help

```bash
a11y-guard --help        # All commands overview
a11y-guard init --help   # Init command details
a11y-guard scan --help   # Scan command with all options
```

---

## Configuration

Running `a11y-guard init` creates `a11y-config.json` in your project root. You can also edit it manually.

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

#### Configuration Reference

| Option | Values | Description |
|---|---|---|
| `selectedStandard` | `wcag-aa`, `wcag-aaa`, `israel` | Accessibility ruleset to enforce |
| `rules.rtl` | `true`, `false` | Enable RTL direction checking |
| `rules.level` | `AA`, `AAA` | WCAG conformance level |
| `scan.defaultMode` | `quick`, `full` | Default scan mode when no flag is passed |
| `ai.enabled` | `true`, `false` | Generate HTML report with AI fix prompts after each scan |
| `performance.concurrency` | integer or `null` (default: `null`) | Files to scan in parallel. `null` = Auto (computed from RAM + CPU). Configure via `a11y-guard init` |

---

## Supported File Types

No framework configuration is required. A11y-Guard automatically scans all matching files found in your project:

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

A11y-Guard scans multiple files concurrently. By default, the parallel limit is computed automatically from your machine's RAM and CPU — no manual tuning needed.

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

To override, run `a11y-guard init`, enable **advanced options**, and choose a preset or enter a custom value. If your value exceeds the safe ceiling, A11y-Guard will warn and ask for confirmation before saving.

If you set a value manually and it exceeds the safe ceiling at scan time, it is clamped automatically with a warning:
```
[a11y-guard] performance.concurrency "40" exceeds safe limit for your system
in quick mode. Clamped to 24.
```

---

## Accessibility Standards

| Standard | Contrast Ratio | RTL Required | Typical Use |
|---|---|---|---|
| WCAG 2.1 AA | 4.5:1 | No | Most websites |
| WCAG 2.1 AAA | 7:1 | No | Government / Medical |
| Israeli IS 5568 | 4.5:1 | **Yes** | Israeli websites (legally required) |

> Run `a11y-guard help standards` for a full breakdown.

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
a11y-guard scan -o json

# Save to file (recommended for CI)
a11y-guard scan --json-file report
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

When `ai.enabled` is `true` in your config, A11y-Guard automatically generates a self-contained HTML report after every terminal scan and opens it in your default browser.

The report includes:
- All violations grouped by file with severity badges
- Per-file copy-paste AI fix prompts (ready to paste into any AI agent)
- Impact filter bar (All / Critical / Serious / Moderate / Minor)
- Sidebar file search
- Light / dark mode toggle

### Summary Mode

Minimal output for quick CI log checks:

```bash
a11y-guard scan --summary
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

Use exit gate flags to control when the pipeline fails:

```bash
# Block only on critical violations (loosest gate)
a11y-guard scan --fail-on-critical

# Block on serious or critical violations
a11y-guard scan --fail-on-serious

# Block on any violation (strictest gate)
a11y-guard scan --fail-on-any
```

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

      - name: Install A11y-Guard
        run: npm install -g a11y-guard

      - name: Run accessibility scan
        run: a11y-guard scan --fail-on-critical --json-file a11y-report

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: accessibility-report
          path: a11y-report.json
```

### GitLab CI

```yaml
accessibility:
  image: node:20
  script:
    - npm ci
    - npm install -g a11y-guard
    - a11y-guard scan --fail-on-critical --json-file a11y-report
  artifacts:
    paths:
      - a11y-report.json
```

### Jenkins

```groovy
stage('Accessibility') {
  steps {
    sh 'npm install -g a11y-guard'
    sh 'a11y-guard scan --fail-on-critical --json-file a11y-report'
    archiveArtifacts artifacts: 'a11y-report.json'
  }
}
```

> Run `a11y-guard help ci` for more CI/CD examples.

---

## Path Handling

A11y-Guard is cross-platform. Forward slashes and backslashes are both supported:

```bash
# All of these work on any OS
a11y-guard scan ./src
a11y-guard scan .\src
a11y-guard scan src/components
a11y-guard scan src\components
```

---

## Troubleshooting

**"No configuration found"**
Run `a11y-guard init` to create `a11y-config.json`.

**Full scan fails — Chromium not found**
Download the browser once:
```bash
npx playwright install chromium
```

**Contrast not checked in quick mode**
Contrast requires a real browser. Use `--full`:
```bash
a11y-guard scan --full
```

**Files not being scanned**
Check that files are not inside `node_modules/`, `dist/`, or `build/`, and that they use a supported extension (`.html`, `.htm`, `.jsx`, `.tsx`, `.vue`, `.component.html`, `.component.ts`).

**`--changed` returns an error**
`--changed` requires git and at least two commits. Run from inside a git repository.

> Run `a11y-guard help faq` for a full list of common questions.

---

## Project Structure

```
a11y-guard/
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
├── a11y-config.json                   # Project configuration (user-generated)
├── package.json
├── README.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## Roadmap

Features planned or in progress:

- **`--report` flag** — Expose the HTML report as a standalone CLI flag (`a11y-guard scan --report`) so it can be generated without enabling `ai.enabled` in config.
- **UI preferences** — Per-project control over summary style and which violation fields are shown in terminal output, configurable via `a11y-guard init ui`.
- **Config validation** — Warn on unknown or misspelled keys in `a11y-config.json` instead of silently falling back to defaults.

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