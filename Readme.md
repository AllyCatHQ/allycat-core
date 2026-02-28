# A11y-Guard

>The accessibility tool that works the way developers work — terminal, watch mode, CI gates, and AI fix prompts in one.

> Professional CLI for accessibility compliance testing.

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
| ⚙️ Parallel Scanning | Concurrent file scanning with RAM-aware concurrency control |
| 📖 Built-in Help | FAQ, examples, CI guides, and standards explained |

---

## Requirements

- Node.js >= 18.0.0
- npm >= 9.0.0

> Full scan mode (contrast checking) additionally requires Playwright — see [Installation](#installation).

---

## Installation

```bash
npm install -g a11y-guard
```

For full scan mode (contrast checking):

```bash
npm install playwright @axe-core/playwright
npx playwright install chromium
```

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

> No framework selection is required. The scanner automatically detects `.html`, `.jsx`, and `.tsx` files.

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
| `--json-file [name]` | | Save report to a JSON file |
| `--fail-on-critical` | | Exit code 1 if any critical violations found |
| `--fail-on-serious` | | Exit code 1 if any serious or critical violations found |
| `--fail-on-any` | | Exit code 1 if any violations found (strictest gate) |
| `--changed` | | Scan only files changed since the last git commit |

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
    "concurrency": 5
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
| `performance.concurrency` | integer (default: `5`) | Number of files scanned in parallel |

---

## Supported File Types

No framework configuration is required. A11y-Guard automatically scans all matching files found in your project:

| File Type | Extension | Notes |
|---|---|---|
| HTML | `.html` | Scanned natively |
| React / TSX | `.jsx`, `.tsx` | Transformed to HTML before scanning |

> Files inside `node_modules/`, `dist/`, and `build/` are always ignored.

---

## Parallel Scanning & RAM Management

A11y-Guard scans multiple files concurrently using `performance.concurrency` from your config. The default is **5 files in parallel** for quick mode and **3** for full mode.

The engine enforces a **RAM-aware ceiling** — even if you set a high concurrency value, it will be automatically clamped to a safe limit based on your machine's available memory:

- Quick scan: ~150 MB per concurrent file slot
- Full scan: ~500 MB per concurrent file slot (Playwright/Chromium)
- Maximum: 60% of total system RAM, hard cap at 50

```json
{
  "performance": {
    "concurrency": 10
  }
}
```

If your value exceeds the safe ceiling for your machine, A11y-Guard will warn you and clamp automatically:

```
[a11y-guard] performance.concurrency "10" exceeds safe limit for your system
in quick mode. Clamped to 7.
```

> On a 16 GB machine: quick mode ceiling ≈ 64, full mode ceiling ≈ 19.

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

| Code | Meaning |
|---|---|
| `0` | Scan completed — threshold not met, pipeline continues |
| `1` | Threshold met — pipeline blocked |

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

**"Cannot find package 'playwright'"**
Install Playwright for full scan support:
```bash
npm install playwright @axe-core/playwright
npx playwright install chromium
```

**Contrast not checked in quick mode**
Contrast requires a real browser. Use `--full`:
```bash
a11y-guard scan --full
```

**Files not being scanned**
Check that files are not inside `node_modules/`, `dist/`, or `build/`, and that they use a supported extension (`.html`, `.jsx`, `.tsx`).

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
│   │   ├── scan.js                    # `scan` orchestration & exit gates
│   │   ├── scanOutputters.js          # Output routing (terminal, JSON, AI report)
│   │   ├── help.js                    # `help` command
│   │   └── helpContent.js             # FAQ, examples, CI snippets
│   ├── engine/
│   │   ├── scanners/
│   │   │   ├── quickScanner.js        # JSDOM-based scanner (parallel, p-limit)
│   │   │   └── fullScanner.js         # Playwright-based scanner
│   │   ├── transformers/
│   │   │   └── jsxTransformer.js      # JSX/TSX → HTML transformer (Babel)
│   │   └── report/
│   │       ├── generator.js           # HTML report entry point
│   │       ├── html.js                # HTML assembly
│   │       ├── styles.js              # Report CSS
│   │       ├── script.js              # Report client-side JS
│   │       └── promptGenerator.js     # AI fix prompt builder
│   └── utils/
│       ├── configLoader.js            # Config load, save, RAM-aware concurrency clamping
│       ├── fileResolver.js            # File discovery & extension filtering
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

These features have partial groundwork in the codebase but are not yet fully implemented or exposed:

- **`ai.agent` config option** — The prompt generator supports agent-specific prompt styles (`claude`, `chatgpt`, `cursor`, `gemini`, `copilot`) but the `init` wizard does not yet ask for this, and it is not written to `a11y-config.json`.
- **Vue and Angular support** — `.vue` and `.component.html` file types are not yet scanned. Only `.html`, `.jsx`, and `.tsx` are currently supported.

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