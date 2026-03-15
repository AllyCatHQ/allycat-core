# AllyCat: Functional Testing Guide

> **Purpose:** Step-by-step manual verification that every feature of the tool works correctly.
> Run this guide before any release to confirm the tool behaves as expected end-to-end.
>
> **Related documents:**
> - CSS delivery testing → [`docs/technical/css-delivery/css-delivery-testing.md`](../technical/css-delivery/css-delivery-testing.md)
> - Cross-machine testing → [`docs/contributing/cross-machine-testing.md`](cross-machine-testing.md)
> - Release gate checklist → [`docs/BEFORE-EVERY-RELEASE.md`](../BEFORE-EVERY-RELEASE.md)
>
> Status keys: ✅ Pass · ❌ Fail · ⬜ Not yet run

---

## Prerequisites

Before starting, ensure:

```bash
# 1. Install dependencies
npm install

# 2. Create a config file (required by most tests)
node src/index.js init
# Accept all defaults — standard: wcag-aa, mode: quick, rtl: false, ai: false

# 3. (Full-scan tests only) Install Playwright Chromium
npx playwright install chromium
```

---

## 1. Init Wizard

```bash
node src/index.js init
```

- [ ] Wizard launches without error
- [ ] All prompts appear in order: standard → scan mode → RTL → AI → concurrency
- [ ] Selecting all defaults completes without crash
- [ ] `a11y-config.json` is created in the project root
- [ ] Re-running init offers: Overwrite / View / Delete options — not an instant overwrite

**Expected `a11y-config.json` after accepting defaults:**
```json
{
  "standard": "wcag-aa",
  "scanMode": "quick",
  "rtl": false,
  "aiEnabled": false
}
```

---

## 2. CLI Basics

```bash
node src/index.js --version
node src/index.js --help
node src/index.js help
```

- [ ] `--version` prints the version string from `package.json` (not hardcoded `1.0.0`)
- [ ] `--help` renders without errors, no placeholder or `undefined` text visible
- [ ] `help` (subcommand) shows FAQ content without errors

---

## 3. Quick Scan — Per File Type

Quick scan uses JSDOM. It does **not** check contrast. All tests below use the default quick mode.

### 3.1 HTML

```bash
node src/index.js scan tests/fixtures/sample.html
```

**Expected violations (6 total):**
- `image-alt` · critical — `<img src="logo.png">` at line 9 (missing alt)
- `button-name` · critical — 4× `<button></button>` at lines 12–15
- `label` · critical — `<input type="text">` at line 17 (missing label)

- [ ] All 6 violations reported
- [ ] Line numbers match the source file
- [ ] No crash, no stack trace

---

### 3.2 JSX

```bash
node src/index.js scan tests/fixtures/sample.jsx
```

**Expected violations:**
- `image-alt` · critical — `<img src="logo.png" />` (missing alt)
- `link-name` · serious — `<a href="#">Click here</a>` (generic link text)

- [ ] Both violations reported
- [ ] Line numbers point to the JSX source lines (not transformed HTML lines)
- [ ] No Babel/transform error in output

---

### 3.3 Vue

```bash
node src/index.js scan tests/fixtures/sample.vue
```

**Expected violations:**
- `image-alt` · critical — `<img src="hero.png">` (missing alt)
- `label` · critical — `<input type="text">` (missing label)
- `link-name` · serious — `<a href="...">click here</a>` (generic text)
- `heading-order` · moderate — `<h3>` after `<h1>` (skipped level)

- [ ] Violations reported from `<template>` block
- [ ] Dynamic binding `:aria-label="'Paragraph label'"` does **not** produce a false positive
- [ ] `@click` on a `div role="button"` does not produce a false positive
- [ ] Line numbers reference the `.vue` source file

---

### 3.4 Angular HTML Template

```bash
node src/index.js scan tests/fixtures/sample.component.html
```

**Expected violations (2 intentional):**
- `image-alt` · critical — `<img src="logo.png">` (static, no binding — line 21)
- `button-name` · critical — `<button [disabled]="isLoading">` with no text (line 38)

- [ ] Both violations caught
- [ ] `[alt]="bannerAlt"` on the other `<img>` does **not** produce a false positive (dynamic alt preserved)
- [ ] `[attr.aria-label]` bindings do **not** produce false positives
- [ ] Angular 17+ `@if`/`@for` blocks parsed without errors

---

### 3.5 Angular TS Component

```bash
node src/index.js scan tests/fixtures/sample.component.ts
```

- [ ] Scan runs without error (TS component without violations should produce clean output)
- [ ] No crash from decorators or TypeScript syntax

---

### 3.6 HTM extension

```bash
node src/index.js scan tests/samples/test.htm
```

- [ ] `.htm` extension recognized and scanned (not skipped as unsupported)

---

## 4. Full Scan (Playwright / Chromium)

Full scan adds contrast checking. Requires Chromium installed.

```bash
node src/index.js scan tests/fixtures/sample.html --full
```

- [ ] Scan runs using Playwright (not JSDOM)
- [ ] Header shows "Full (with contrast)" label
- [ ] Same violations from Section 3.1 are still present
- [ ] No Chromium-not-found error (if Chromium is installed correctly)

**If Chromium is NOT installed, test the error message:**
```bash
# Temporarily rename Chromium executable, then run --full
node src/index.js scan tests/fixtures/sample.html --full
```
- [ ] Error message is clear and actionable — should suggest `npx playwright install chromium`
- [ ] No raw stack trace shown to the user

---

## 5. Standards

Each standard enables a different axe rule set. Test the three supported values.

### 5.1 WCAG 2.1 AA (default)

```bash
node src/index.js scan tests/fixtures/sample.html
# (uses wcag-aa from a11y-config.json)
```
- [ ] Runs without error, reports AA-level violations

### 5.2 WCAG 2.1 AAA

```bash
# Temporarily set standard to wcag-aaa in a11y-config.json, then:
node src/index.js scan tests/fixtures/sample.html
```
- [ ] Scan header shows "WCAG 2.1 AAA"
- [ ] More violations may appear compared to AA (AAA has stricter rules)
- [ ] No crash

### 5.3 Israeli Standard (IS 5568)

```bash
# Set standard to israel + rtl: true in a11y-config.json, then:
node src/index.js scan tests/samples/html/RtlBad.html
```

**Expected violations (5 total):**
- `israel-rtl` · serious — `<html lang="he">` missing `dir="rtl"` (line 2)
- `image-alt` · critical — `<img src="banner.png">` (line 24)
- `label` · critical — `<input name="fullname">` (line 27)
- `label` · critical — `<input name="email">` (line 28)
- `button-name` · critical — `<button></button>` (line 29)

- [ ] All 5 violations reported
- [ ] `israel-rtl` violation appears (RTL-specific rule, not in AA/AAA)
- [ ] Scan header shows "Israeli Standard IS 5568"

**Confirm RTL-good file is clean:**
```bash
node src/index.js scan tests/samples/html/RtlGood.html
```
- [ ] No `israel-rtl` violation (file has `dir="rtl"` correctly set)

---

## 6. RTL Detection (Standalone)

Test RTL checking independently of the Israeli standard:

```bash
# Set rtl: true and standard: wcag-aa in a11y-config.json, then:
node src/index.js scan tests/samples/react/jsx/RtlBad.jsx
node src/index.js scan tests/samples/react/jsx/RtlGood.jsx
```

- [ ] `RtlBad.jsx` — RTL violation reported
- [ ] `RtlGood.jsx` — No RTL violation
- [ ] RTL violations appear alongside regular axe violations, not instead of them

---

## 7. Output Modes

### 7.1 Default terminal output

```bash
node src/index.js scan tests/fixtures/sample.html
```
- [ ] Violations grouped by rule
- [ ] Each violation shows: rule ID, impact, element snippet, line number, file path
- [ ] VS Code link (`vscode://file/...`) appears per violation

### 7.2 Summary mode

```bash
node src/index.js scan tests/fixtures/sample.html --summary
```
- [ ] Clean summary table printed (violation counts per severity)
- [ ] No individual violation detail blocks
- [ ] No stack traces

### 7.3 JSON output (stdout)

```bash
node src/index.js scan tests/fixtures/sample.html --output json
```
- [ ] Output is valid JSON (verify by piping: `node src/index.js scan tests/fixtures/sample.html --output json | node -e "let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{ JSON.parse(d); console.log('valid JSON'); })"`)
- [ ] Contains `violations` array with correct structure
- [ ] No non-JSON text mixed into stdout

### 7.4 JSON file output

```bash
node src/index.js scan tests/fixtures/sample.html --json-file
```
- [ ] A `.json` file is created in the project root (or specified output dir)
- [ ] File contains valid JSON with `violations` array
- [ ] Terminal confirms the file path written

### 7.5 HTML report

The HTML report is auto-generated when `ai.enabled: true` in `a11y-config.json`. There is no `--report` flag.

```bash
# Set ai.enabled: true in a11y-config.json, then:
node src/index.js scan tests/fixtures/sample.html
```
- [ ] `a11y-report.html` created in project root
- [ ] Open in browser — report renders without errors
- [ ] Dark/light toggle works
- [ ] Violation filter (by severity) works
- [ ] File search works
- [ ] Each violation entry has a clickable VS Code link
- [ ] No external CDN dependencies (file should work offline)

---

## 8. Exit Codes / Threshold Flags

Run the automated E2E test first:

```bash
node tests/e2e/thresholds.test.js
```
- [ ] `8/8 passed`

Then verify manually for confidence:

```bash
node src/index.js scan tests/fixtures/fail-on-critical.html --fail-on-critical
echo "Exit: $?"   # expected: 1

node src/index.js scan tests/fixtures/fail-on-critical.html --fail-on-serious
echo "Exit: $?"   # expected: 2

node src/index.js scan tests/fixtures/fail-on-critical.html --fail-on-any
echo "Exit: $?"   # expected: 3

node src/index.js scan tests/fixtures/fail-on-clean.html --fail-on-any
echo "Exit: $?"   # expected: 0

node src/index.js scan tests/fixtures/fail-on-critical.html
echo "Exit: $?"   # expected: 0 (no flag = no gate)
```

- [ ] All 5 exit codes match expected values

---

## 9. Concurrency

```bash
node tests/e2e/concurrency.test.js
```

- [ ] Prints machine RAM and computed quick/full ceilings
- [ ] Quick ceiling ≥ 1
- [ ] Full ceiling ≥ 1 and ≤ 3
- [ ] No crash

**Manual scan of a directory (tests concurrency in practice):**

```bash
node src/index.js scan tests/samples/react/jsx/
```

- [ ] Multiple files scanned in parallel (no hang)
- [ ] All `.jsx` files in the directory are picked up
- [ ] `node_modules/` inside `tests/samples/npm-css/` is **not** scanned

---

## 10. CSS Delivery Testing

Full CSS delivery test suite (15 features, all requiring `--full`):

```bash
node tests/e2e/css-delivery.test.js
```

- [ ] `15/15 tests passed`

For detailed per-feature manual commands, see:
**[`docs/technical/css-delivery/css-delivery-testing.md`](../technical/css-delivery/css-delivery-testing.md)**

---

## 11. Watch Mode

Watch mode requires manual interaction — there is no automated test for it.

```bash
# Terminal 1 — start watch mode
node src/index.js scan tests/fixtures/ --watch
```

- [ ] Watch starts without error
- [ ] Initial scan runs and prints violations for all files in `tests/fixtures/`
- [ ] Console shows "Watching for changes..." (or equivalent)

**Trigger a change — Terminal 2:**
```bash
# Append a harmless comment to sample.html to trigger a rescan
echo "<!-- watch test -->" >> tests/fixtures/sample.html
```

- [ ] Watch mode detects the file change within ~1 second
- [ ] Re-scan runs automatically
- [ ] Violations that were already present show `[NEW]` only on first appearance
- [ ] Violations that disappeared (if you fix one) show `[FIXED]`

**Revert the test change:**
```bash
# Remove the last line added
# (edit sample.html manually or use git restore)
git restore tests/fixtures/sample.html
```

- [ ] Watch exits cleanly on Ctrl+C

---

## 12. `--changed` Flag

The `--changed` flag scans only files modified since the last git commit.

```bash
# 1. Make a small edit to a tracked file
echo "<!-- changed test -->" >> tests/fixtures/sample.html

# 2. Run with --changed
node src/index.js scan tests/fixtures/ --changed

# 3. Confirm only sample.html was scanned (not the entire directory)

# 4. Revert
git restore tests/fixtures/sample.html
```

- [ ] Only the modified file is scanned (not all files in the directory)
- [ ] Violations from the modified file are shown
- [ ] Unmodified files in the same directory are skipped
- [ ] No crash when the target is a directory with mixed staged/unstaged files

---

## 13. Edge Cases

### 13.1 Vue edge cases

```bash
node src/index.js scan tests/fixtures/vue-edge-cases.vue
```

- [ ] Nested elements (e.g. button inside a link) handled without false positives
- [ ] Dynamic bindings (`:alt`, `:aria-label`) do not produce false positives
- [ ] At least 2 intentional violations are reported

### 13.2 Angular edge cases

```bash
node src/index.js scan tests/fixtures/angular-edge-cases.component.html
```

- [ ] `[attr.aria-label]` bindings do not produce false positives
- [ ] At least 2 intentional violations are reported (missing img alt + empty button)

### 13.3 No config file

```bash
# Temporarily rename a11y-config.json
mv a11y-config.json a11y-config.json.bak

node src/index.js scan tests/fixtures/sample.html

mv a11y-config.json.bak a11y-config.json
```

- [ ] Tool does **not** crash — falls back to defaults (WCAG 2.1 AA, quick mode)
- [ ] Console prints a message about using defaults and suggests running `init`

### 13.4 No files found

```bash
node src/index.js scan tests/samples/npm-css/node_modules/
```

- [ ] Prints "No matching files found to scan" (or equivalent)
- [ ] Exits cleanly (exit 0), no crash

### 13.5 Single file (not a directory)

```bash
node src/index.js scan tests/fixtures/sample.html
```

- [ ] Works correctly when target is a file path, not a directory

### 13.6 TSX file

```bash
node src/index.js scan tests/samples/react/tsx/ComprehensiveTest.tsx
```

- [ ] `.tsx` extension recognized, Babel transforms TypeScript JSX correctly
- [ ] Violations reported with correct line numbers

---

## Summary Checklist

| Section | Test | Status |
|---|---|:---:|
| 1 | Init wizard | ⬜ |
| 2 | CLI basics (--version, --help) | ⬜ |
| 3.1 | Quick scan — HTML | ⬜ |
| 3.2 | Quick scan — JSX | ⬜ |
| 3.3 | Quick scan — Vue | ⬜ |
| 3.4 | Quick scan — Angular HTML | ⬜ |
| 3.5 | Quick scan — Angular TS | ⬜ |
| 3.6 | Quick scan — .htm extension | ⬜ |
| 4 | Full scan (Playwright) | ⬜ |
| 5.1 | Standard: WCAG 2.1 AA | ⬜ |
| 5.2 | Standard: WCAG 2.1 AAA | ⬜ |
| 5.3 | Standard: Israeli IS 5568 | ⬜ |
| 6 | RTL detection | ⬜ |
| 7.1 | Output: terminal | ⬜ |
| 7.2 | Output: --summary | ⬜ |
| 7.3 | Output: --output json | ⬜ |
| 7.4 | Output: --json-file | ⬜ |
| 7.5 | Output: HTML report (ai.enabled) | ⬜ |
| 8 | Exit codes / threshold flags | ⬜ |
| 9 | Concurrency | ⬜ |
| 10 | CSS delivery (15 features) | ⬜ |
| 11 | Watch mode | ⬜ |
| 12 | --changed flag | ⬜ |
| 13.1 | Edge case: Vue dynamic bindings | ⬜ |
| 13.2 | Edge case: Angular dynamic bindings | ⬜ |
| 13.3 | Edge case: no config file | ⬜ |
| 13.4 | Edge case: no files found | ⬜ |
| 13.5 | Edge case: single file target | ⬜ |
| 13.6 | Edge case: TSX | ⬜ |
