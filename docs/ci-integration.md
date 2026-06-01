# CI/CD Integration Guide

This guide covers exit codes, baseline workflows, CI mode, and pipeline examples for GitHub Actions, GitLab CI, and Jenkins.

---

## Exit Codes

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

---

## Violation Baseline

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

## CI Mode

The `--ci` flag is a single-flag preset for pipeline use. It strips developer-focused output and sets `--fail-on-critical`:

```bash
allycat scan --ci
```

Equivalent to:

```bash
allycat scan \
  --no-snippet \
  --no-help \
  --no-wcag \
  --no-selector \
  --no-affected \
  --summary-style compact \
  --fail-on-critical
```

Output in CI mode:

```
✖ 3 violations (2 critical, 1 serious) in 2 files

  CRITICAL  Image missing alt text
    Rule: image-alt  ·  src/components/Hero.jsx:14

  CRITICAL  Button has no accessible name
    Rule: button-name  ·  src/App.jsx:32

  SERIOUS  Link has no discernible text
    Rule: link-name  ·  src/layout/Nav.jsx:8
```

Apply flags individually for partial suppression:

| Flag | Effect |
|---|---|
| `--no-snippet` | Hide HTML snippet per violation |
| `--no-help` | Hide help text per violation |
| `--no-wcag` | Hide WCAG tags per violation |
| `--no-selector` | Hide element selector per violation |
| `--no-affected` | Hide affected element count per violation |
| `--summary-style compact` | Single-line summary instead of the bordered box |

---

## JSON Report Structure

When using `--json-file` or `-o json`, the output follows this shape:

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

---

## GitHub Actions

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
        run: allycat scan --ci --json-file allycat-report

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: accessibility-report
          path: allycat-report.json
```

## GitLab CI

```yaml
accessibility:
  image: node:20
  script:
    - npm ci
    - npm install -g allycat
    - allycat scan --ci --json-file allycat-report
  artifacts:
    paths:
      - allycat-report.json
```

## Jenkins

```groovy
stage('Accessibility') {
  steps {
    sh 'npm install -g allycat'
    sh 'allycat scan --ci --json-file allycat-report'
    archiveArtifacts artifacts: 'allycat-report.json'
  }
}
```
