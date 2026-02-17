# A11y-Guard

Professional CLI for accessibility compliance testing.

Fast, developer-friendly accessibility scanning with support for WCAG 2.1 AA/AAA and Israeli Standard (IS 5568).

## Features

- 🚀 **Quick Scan** — Fast JSDOM-based scanning (~1s)
- 🔍 **Full Scan** — Playwright-based with real browser rendering and contrast checking
- 🇮🇱 **Israeli Standard** — Built-in IS 5568 compliance with RTL support
- 📍 **Precise Locations** — Line numbers and clickable VS Code links
- 📊 **Multiple Output Formats** — Terminal, JSON, and file export
- ⚡ **CI/CD Ready** — JSON output for pipeline integration
- 📖 **Built-in Help** — FAQ, examples, and guides included

## Installation

```bash
npm install -g a11y-guard
```

For full scan mode (contrast checking), also install:

```bash
npm install playwright @axe-core/playwright
npx playwright install chromium
```

## Quick Start

```bash
# Initialize configuration
a11y-guard init

# Scan your project
a11y-guard scan

# Scan specific folder or file
a11y-guard scan ./src
a11y-guard scan ./src/components/Button.tsx
```

---

## Commands

### `a11y-guard init`

Interactive setup wizard to configure your project.

```bash
a11y-guard init
```

Prompts for:
- Framework (React, Vue, Angular, HTML)
- Accessibility standard (WCAG AA, AAA, Israeli)
- RTL support
- Default scan mode

Creates `a11y-config.json` in your project root.

---

### `a11y-guard scan [target]`

Scan files for accessibility violations.

```bash
# Scan entire project
a11y-guard scan

# Scan specific directory
a11y-guard scan ./src

# Scan specific file
a11y-guard scan ./src/pages/Home.tsx
```

#### Scan Options

| Option | Short | Description |
|--------|-------|-------------|
| `--quick` | `-q` | Quick scan (fast, skips contrast check) |
| `--full` | `-f` | Full scan (slower, includes contrast check) |
| `--summary` | `-s` | Show only violation counts (no details) |
| `--output <format>` | `-o` | Output format: `terminal`, `json` |
| `--json-file [name]` | | Save JSON report to file |

#### Examples

```bash
# Quick scan (default)
a11y-guard scan

# Full scan with contrast checking
a11y-guard scan --full

# Summary only (just counts)
a11y-guard scan --summary

# JSON output to terminal
a11y-guard scan -o json

# Save JSON report (auto-generated filename)
a11y-guard scan --json-file
# Output: a11y-report-2025-05-27-143052.json

# Save JSON report with custom name
a11y-guard scan --json-file my-report
# Output: my-report.json

# Combined options
a11y-guard scan ./src --full --summary
a11y-guard scan ./src -f --json-file
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
a11y-guard help standards  # Accessibility standards explained
```

#### Help Topics

| Topic | Description |
|-------|-------------|
| `faq` | Common questions about contrast, Playwright, config, paths |
| `examples` | 15+ examples grouped by category |
| `ci` | Copy-paste configs for GitHub Actions, GitLab CI, Jenkins |
| `standards` | WCAG AA vs AAA vs Israeli comparison |

#### Command-Specific Help

```bash
a11y-guard --help        # Overview of all commands
a11y-guard init --help   # Init command details
a11y-guard scan --help   # Scan command details with all options
```

---

## Output Formats

### Terminal (Default)

Colored, grouped output with clickable file links:

```
src/components/Button.tsx
3 issues

  CRITICAL  Ensure buttons have discernible text
   Rule: button-name
   File: src/components/Button.tsx:14
   Element: button
   HTML: <button onclick="..."></button>
   Help: Buttons must have discernible text
   WCAG: wcag2a, wcag412

✖ Found 3 violations in 1 file
   1 critical, 2 moderate
   (use --full for contrast checking)
```

### JSON Output

For CI/CD integration and programmatic access:

```bash
# Output to terminal
a11y-guard scan -o json

# Pipe to file (shell redirection)
a11y-guard scan -o json > report.json

# Direct file export (recommended)
a11y-guard scan --json-file report
```

JSON structure:

```json
{
  "timestamp": "2025-02-17T14:30:52.123Z",
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

### Summary Mode

Minimal output for quick checks:

```bash
a11y-guard scan --summary
```

```
✖ Found 14 violations in 3 files
   3 critical, 1 serious, 10 moderate
   (use --full for contrast checking)
```

---

## Scan Modes

### Quick Mode (Default)

- Uses JSDOM for fast HTML parsing
- ~1 second per file
- **Skips contrast checking** (requires real browser)
- Best for: Development, quick feedback

### Full Mode

- Uses Playwright with real Chromium browser
- ~5 seconds startup + ~1 second per file
- **Includes contrast checking**
- Best for: CI/CD, comprehensive audits

```bash
# Set default in config via init wizard
a11y-guard init

# Or override per scan
a11y-guard scan --full
a11y-guard scan --quick
```

---

## Accessibility Standards

| Standard | Contrast Ratio | RTL Required | Best For |
|----------|----------------|--------------|----------|
| **WCAG AA** | 4.5:1 | No | Most websites |
| **WCAG AAA** | 7:1 | No | Government, Medical |
| **Israeli IS 5568** | 4.5:1 | Yes | Israeli websites |

Set your standard during `a11y-guard init` or in `a11y-config.json`.

---

## Configuration

The `a11y-config.json` file stores your project settings:

```json
{
  "framework": "react",
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
  }
}
```

### Configuration Options

| Option | Values | Description |
|--------|--------|-------------|
| `framework` | `react`, `vue`, `angular`, `html` | Determines file extensions to scan |
| `selectedStandard` | `wcag-aa`, `wcag-aaa`, `israel` | Accessibility ruleset |
| `rules.rtl` | `true`, `false` | Enable RTL direction checking |
| `rules.level` | `AA`, `AAA` | WCAG conformance level |
| `scan.defaultMode` | `quick`, `full` | Default scan mode |

---

## Supported Frameworks

| Framework | Extensions | Status |
|-----------|------------|--------|
| React | `.jsx`, `.tsx`, `.html` | ✅ Supported |
| Vue | `.vue`, `.html` | ✅ Supported |
| Angular | `.html`, `.component.html` | ✅ Supported |
| HTML | `.html` | ✅ Supported |

---

## Path Handling

A11y-Guard supports both forward slashes and backslashes (cross-platform):

```bash
# All of these work
a11y-guard scan ./src
a11y-guard scan .\src
a11y-guard scan src/components
a11y-guard scan src\components
```

---

## CI/CD Integration

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
        run: a11y-guard scan --json-file a11y-report
      
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
    - a11y-guard scan --json-file a11y-report
  artifacts:
    paths:
      - a11y-report.json
```

### Jenkins

```groovy
stage('Accessibility') {
  steps {
    sh 'npm install -g a11y-guard'
    sh 'a11y-guard scan --json-file a11y-report'
    archiveArtifacts artifacts: 'a11y-report.json'
  }
}
```

> 💡 **Tip:** Run `a11y-guard help ci` for more CI/CD examples.

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Scan completed (with or without violations) |

> **Note:** Future versions may add `--fail-on-critical` to exit with code 1 when critical violations are found.

---

## Troubleshooting

### "No configuration found"

Run `a11y-guard init` to create the configuration file.

### "Cannot find package 'playwright'"

Install Playwright for full scan mode:

```bash
npm install playwright @axe-core/playwright
npx playwright install chromium
```

### Contrast checking not working in quick mode

Contrast checking requires a real browser. Use `--full` mode:

```bash
a11y-guard scan --full
```

### Files not being scanned

Check these common issues:
1. File extension matches your framework config
2. Files are not in `node_modules/`, `dist/`, or `build/`
3. Framework is set correctly in `a11y-config.json`

> 💡 **Tip:** Run `a11y-guard help faq` for more troubleshooting tips.

---

## Getting Help

```bash
# Built-in help
a11y-guard --help           # Command overview
a11y-guard help faq         # Common questions
a11y-guard help examples    # Usage examples
a11y-guard help standards   # Standards explained

# Online
# GitHub Issues: https://github.com/YOUR_USERNAME/a11y-guard/issues
```

---

## License

MIT

---

## Contributing

Contributions welcome! Please read our contributing guidelines before submitting PRs.

---

## Acknowledgments

- [axe-core](https://github.com/dequelabs/axe-core) — Accessibility testing engine
- [Playwright](https://playwright.dev/) — Browser automation for full scans
- [JSDOM](https://github.com/jsdom/jsdom) — DOM implementation for quick scans