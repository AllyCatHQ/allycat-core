<div align="center">

# AllyCat

[![CI](https://github.com/AllyCatHQ/allycat-core/actions/workflows/ci.yml/badge.svg)](https://github.com/AllyCatHQ/allycat-core/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/allycat.svg)](https://www.npmjs.com/package/allycat)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Downloads](https://img.shields.io/npm/dw/allycat.svg)](https://www.npmjs.com/package/allycat)
[![Total Downloads](https://img.shields.io/npm/dt/allycat.svg)](https://www.npmjs.com/package/allycat)
[![GitHub Stars](https://img.shields.io/github/stars/AllyCatHQ/allycat-core?style=social)](https://github.com/AllyCatHQ/allycat-core)

<p>⭐ It takes one second to <a href="https://github.com/AllyCatHQ/allycat-core">star this project</a> - and keeps me motivated for weeks after.</p>

</div>

> **A source-first accessibility scanner** — catch WCAG violations in your editor, on every save, or as a CI gate that blocks inaccessible code from shipping.
>
> While 1 in 4 adults has a disability and web accessibility lawsuits are on the rise, most violations still make it into production. *Why?* There's no real check in the development process. *AllyCat closes that gap.*
>
> *Built for the way developers actually work — source files, pre-commit hooks, and CI pipelines. No deployed app required.*

**Supports**: JSX/TSX, Vue, Angular, HTML • RTL support (experimental) • Quick (JSDOM) & Full (Playwright) modes

<p align="center">
  <img src="https://raw.githubusercontent.com/AllyCatHQ/allycat-core/main/assets/demo-optimize.gif" alt="AllyCat scanning files — violations found and reported" />
</p>

---

## Table of Contents

- [Features](#features)
- [Why AllyCat](#why-allycat)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Commands](#commands)
- [Configuration](#configuration)
- [Supported File Types](#supported-file-types)
- [Output Formats](#output-formats)
- [CI/CD Integration](#cicd-integration)
- [More](#more)
- [License](#license)

---

## Features

- ⚡ **Lightning-fast** JSDOM scans (~1s/file, no browser needed)
- 🔍 **Full browser** scans with real contrast checking via Playwright
- 🔤 **RTL support** (experimental) — opt-in for Hebrew, Arabic, Persian interfaces
- 📍 **Exact line numbers** with clickable VS Code links
- 📋 **AI-ready fix prompts** — copy-paste into your AI agent (no API key, no data sent)
- ⚙️ **Watch mode** with NEW/FIXED delta detection
- 🛠️ **CI-ready** — baselines, exit codes, and `--changed` git scoping
- 📊 Terminal, JSON, and self-contained HTML outputs

---

## Why AllyCat

Most accessibility tools need a deployed app. AllyCat scans your source files directly — JSX, Vue, Angular, HTML — giving you exact line numbers and AI-ready fix prompts before anything ships.

<details>
<summary>Why AllyCat vs axe-core/cli</summary>

`@axe-core/cli` excels at scanning **live URLs**. AllyCat is designed for **source code** in your editor and pipelines.

| Aspect | AllyCat | @axe-core/cli |
|---|---|---|
| Scanning target | Source files (no server) | Live URL only |
| HTML source files | Yes | No — rendered DOM at URL only |
| JSX / TSX | Yes — Babel transformer | No |
| Vue SFCs | Yes — Vue compiler | No |
| Angular templates | Yes — inline + external | No |
| Exact source line numbers | Yes — clickable VS Code links | No — DOM selector only |
| Watch + git-changed scoping | Yes | No |
| RTL support (experimental) | Yes | No |
| AI-ready fix prompts | Yes | No |
| Quick scan (no browser) | Yes — JSDOM, ~1s/file | No — always full browser |

**Use AllyCat** for pre-commit hooks, local development, and PR pipelines without a deployed app.

</details>

---

## Quick Start

```bash
# 1. Install
npm install -g allycat

# 2. Initialize
allycat init

# 3. Scan
allycat scan
```

> Full scans (contrast checking) require Chromium — install once with `npx playwright install chromium`, then run `allycat scan --full`.

See all options with `allycat scan --help`.

<p align="center">
  <img src="https://raw.githubusercontent.com/AllyCatHQ/allycat-core/main/assets/actions-cli.gif" alt="AllyCat scan output with line numbers, saving a baseline, and catching new violations with --fail-on-new" />
</p>

> *Scan violations with exact line numbers → save a baseline → catch only new violations with `--fail-on-new`*

---

## Installation

```bash
# Global — for personal use
npm install -g allycat

# Per-project — recommended for teams and CI/CD (version-pinned per project)
npm install --save-dev allycat
```

For full scans (contrast checking):
```bash
npx playwright install chromium
```

**Requirements**: Node.js ≥ 20

---

## Commands

### `allycat init`

Interactive setup wizard. Creates `allycat.config.json` in your project root.

```bash
allycat init
```

Prompts for:
- Accessibility standard (WCAG 2.1 AA, WCAG 2.2 AA, WCAG AAA)
- RTL support (experimental, opt-in)
- Default scan mode (quick or full)
- AI-ready fix prompts (enabled/disabled)
- AI agent preference — Claude, Cursor, ChatGPT, Gemini, Copilot, Other / Skip (shown when AI is enabled)
- Report delivery — Auto-open in browser / Save and print path / Ask each time (shown when AI is enabled)
- Concurrency override (optional advanced setting)

> No framework selection needed — the scanner automatically detects `.html`, `.jsx`, `.tsx`, `.vue`, and Angular template files.

---

### `allycat scan [target]`

Scan files for accessibility violations.

```bash
allycat scan                        # entire project
allycat scan ./src                  # specific directory
allycat scan ./src/pages/Home.tsx   # specific file
```

#### Scan Mode

| Option | Short | Description |
|---|---|---|
| `--quick` | `-q` | Fast scan — no browser, skips contrast check (default) |
| `--full` | `-f` | Full scan — real contrast checking via Playwright |
| `--summary` | `-s` | Show violation counts only, no details |

```bash
allycat scan            # quick scan (default)
allycat scan --full     # full scan with contrast checking
allycat scan --summary  # counts only — no per-violation details
```

#### Watch & Scope

| Option | Short | Description |
|---|---|---|
| `--watch` | `-w` | Re-scan automatically on every file save |
| `--existing` | `-e` | Show full details of pre-existing violations on startup (requires `--watch`) |
| `--changed` | `-c` | Scan only files changed since the last git commit |

```bash
allycat scan --watch              # re-scans on every save
allycat scan --watch --existing   # include pre-existing violations on startup
allycat scan --watch --summary    # watch mode with counts only
allycat scan --changed            # git-changed files only (great for pre-commit hooks)
allycat scan --changed ./src      # scoped to a directory

# After each save, watch mode shows a delta:
#   [NEW]   — violation appeared since the last scan
#   [FIXED] — violation was present before and is now resolved
#   (no label) — violation is unchanged
```

#### Path Filtering

| Option | Description |
|---|---|
| `--exclude <path>` | Exclude a path or glob from the scan. Repeatable. When scanning a scoped path, `--exclude` names are automatically resolved relative to that target — no need to type the full path. |

```bash
allycat scan --exclude tests                          # skip the tests folder
allycat scan --exclude tests --exclude src/generated  # skip multiple paths
allycat scan --exclude "**/*.stories.*"               # skip all Storybook stories (glob)
allycat scan --watch --exclude tests                  # exclusion applies on every rescan too
allycat scan scripts --exclude test.html              # scans scripts/ — auto-resolves to scripts/test.html
allycat scan src/components --exclude fixtures        # auto-resolves to src/components/fixtures (entire folder)
allycat scan src/test --exclude __mocks__             # auto-resolves to src/test/__mocks__
```

Stacks on top of the built-in ignores (`node_modules/`, `dist/`, `build/`, `allycat-report.html`). Works in normal scan, watch, and `--changed` modes.

#### CI & Gates

| Option | Short | Description |
|---|---|---|
| `--ci` | | CI preset: compact output + `--fail-on-critical` |
| `--fail-on-critical` | | Exit code 1 if any critical violations found |
| `--fail-on-serious` | | Exit code 2 if any serious or critical violations found |
| `--fail-on-any` | | Exit code 3 if any violations found (strictest gate) |
| `--save-baseline` | | Snapshot current violations to `allycat-baseline.json` — exits 0 always |
| `--fail-on-new` | | Exit code 4 if any violation is not in the saved baseline |
| `--json-file [name]` | `-j` | Save report to a JSON file |

```bash
allycat scan --ci                                     # CI preset — compact output + critical gate
allycat scan --fail-on-critical --json-file report    # block on critical, save report
allycat scan --fail-on-any                            # strictest gate — block on any violation
allycat scan --save-baseline                          # snapshot today's violations
allycat scan --fail-on-new                            # only fail on violations not in baseline
allycat scan --json-file                              # auto-named: allycat-report-2026-06-02-143052.json
allycat scan --json-file ci-report                    # custom name: ci-report.json
```

→ See [CI/CD Integration Guide](docs/ci-integration.md) for exit code reference, baseline workflow, and full pipeline examples.

#### Output

| Option | Short | Description |
|---|---|---|
| `--output <format>` | `-o` | Output format: `terminal` (default) or `json` |
| `--no-snippet` | | Hide HTML snippet per violation |
| `--no-help` | | Hide help text per violation |
| `--no-wcag` | | Hide WCAG tags per violation |
| `--no-selector` | | Hide element selector per violation |
| `--no-affected` | | Hide affected element count per violation |
| `--summary-style <style>` | | Summary style: `default` (box) or `compact` (single line) |

```bash
allycat scan -o json                   # JSON to terminal (pipe-friendly)
allycat scan --no-snippet --no-help    # cleaner terminal output
allycat scan --summary-style compact   # single-line summary
```

Full reference: `allycat scan --help`

---

### `allycat help [topic]`

```bash
allycat help           # List all topics
allycat help faq       # Common questions and answers
allycat help examples  # Real-world usage examples
allycat help ci        # CI/CD integration guide
allycat help standards # Standards explained (WCAG AA vs AAA)
```

Command-specific help:

```bash
allycat --help        # All commands overview
allycat init --help   # Init command details
allycat scan --help   # Scan command with all options
```

---

### `allycat report`

Opens the last generated HTML accessibility report (`allycat-report.html`) in your browser.

```bash
allycat report
```

Run `allycat scan` first. Prints a message and exits if no report file is found.

---

### `allycat feedback`

Opens [GitHub Issues](https://github.com/AllyCatHQ/allycat-core/issues) in your browser to report a bug or request a feature.

```bash
allycat feedback
```

---

### `allycat update`

Check for updates and view release notes.

```bash
allycat update
```

---

## Configuration

Run `allycat init` to create `allycat.config.json` in your project root.
Valid standards are `wcag-aa` (default), `wcag-22-aa`, and `wcag-aaa`.

→ See [Configuration Reference](docs/configuration.md) for all fields, valid values, and manual editing details.

---

## Supported File Types

| File Type | Extensions |
|---|---|
| HTML | `.html`, `.htm` |
| React | `.jsx`, `.tsx` |
| Vue | `.vue` |
| Angular | `.component.html`, `.component.ts` |

Ignores `node_modules/`, `dist/`, `build/`, and `allycat-report.html` by default. Use `--exclude` to add more paths.

---

## Output Formats

- **Terminal** — Color-coded, grouped by file
- **JSON** — For CI/scripts:
  ```bash
  allycat scan -o json             # print to terminal
  allycat scan --json-file report  # save to report.json
  ```
- **HTML Report** — Rich AI fix prompts (auto-opens when enabled)

---

## CI/CD Integration

AllyCat is built for pipelines:

- **Exit gates** — fail on critical, serious, or any violations (`--fail-on-critical`, `--fail-on-serious`, `--fail-on-any`)
- **Baselines** — adopt a gate without fixing pre-existing issues (`--save-baseline` + `--fail-on-new`)
- **PR scoping** — scan only git-changed files (`--changed`)
- **CI preset** — compact output + critical gate in one flag (`--ci`)
- **JSON export** — machine-readable reports for artifact storage (`--json-file`)

| Code | Flag | Meaning |
|---|---|---|
| `0` | — | No threshold flag used, or threshold not met |
| `1` | `--fail-on-critical` | Critical violations found |
| `2` | `--fail-on-serious` | Serious or critical violations found |
| `3` | `--fail-on-any` | Any violations found |
| `4` | `--fail-on-new` | New violation not in saved baseline |

**GitHub Actions example:**
```yaml
- name: Accessibility Scan
  run: allycat scan --ci --json-file allycat-report
```

→ See [CI/CD Integration Guide](docs/ci-integration.md) for GitHub Actions, GitLab CI, Jenkins, and advanced baseline workflows.

---


## More

<details>
<summary>Accessibility Standards</summary>

| Standard | Contrast Ratio | RTL Support | Typical Use |
|---|---|---|---|
| WCAG 2.1 AA | 4.5:1 | Optional | Most websites — current legal baseline (ADA, EN 301 549) |
| WCAG 2.2 AA | 4.5:1 | Optional | New projects — 2025 industry frontier, adds 9 new criteria |
| WCAG AAA (automated) | 7:1 | Optional | Government / Medical — full AAA requires a manual audit |

RTL support is available as an opt-in for all standards — enable it during `allycat init` for Hebrew, Arabic, Persian, and other RTL interfaces. *(experimental)*

Run `allycat help standards` for a full breakdown, or see the official [WCAG 2.1](https://www.w3.org/TR/WCAG21/) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/) specifications.

</details>

<details>
<summary>Troubleshooting</summary>

**Common issues**:

- **No config?** → Run `allycat init`
- **Full scan fails?** → `npx playwright install chromium`
- **No contrast check?** → Contrast requires a real browser: `allycat scan --full`
- **Contrast violations missing on styled-components / Emotion / styled-jsx projects?** → Runtime CSS-in-JS styles cannot be statically analyzed. The scanner will emit a warning per file — this is a known limitation.
- **Files not scanned?** → Check supported extensions and ignored folders
- **`--changed` fails?** → Must be in a git repo with ≥2 commits
- **Wrong path separator?** → Both `/` and `\` work: `allycat scan ./src` and `allycat scan .\src` are equivalent

Run `allycat help faq` for more.

</details>

<details>
<summary>Contributing</summary>

See [CONTRIBUTING.md](./CONTRIBUTING.md)

</details>

<details>
<summary>Acknowledgments</summary>

- [axe-core](https://github.com/dequelabs/axe-core) — Accessibility rules engine
- [Playwright](https://playwright.dev/) — Browser automation for full scan mode
- [JSDOM](https://github.com/jsdom/jsdom) — DOM implementation for quick scan mode
- [Babel](https://babeljs.io/) — JSX/TSX transformation
- [Commander.js](https://github.com/tj/commander.js) — CLI framework

</details>

---

## License

MIT © 2026 Dotan Siman Tov

---

<p align="center">
  <img src="https://raw.githubusercontent.com/AllyCatHQ/allycat-core/main/assets/icon.png" alt="AllyCat logo" width="120" />
</p>
