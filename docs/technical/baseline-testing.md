# Baseline Feature — Testing Guide

> **Scope:** `--save-baseline` and `--fail-on-new` flags.
> Quick scan (JSDOM, default mode). No Playwright required.
> All tests use fixtures in `tests/fixtures/`.

---

## Prerequisites

```bash
# Config file must exist
node src/index.js init

# Clean state — remove any leftover baseline from previous runs
Remove-Item .a11y-baseline.json -ErrorAction SilentlyContinue
```

---

## How the Matching Works

The composite key is: **file path + rule ID + SHA-256(violation.html.trim()) + selector**.

| Field | Included in match? | Notes |
|---|:---:|---|
| File path | ✅ | Absolute path as resolved by the scanner |
| Rule ID | ✅ | e.g. `button-name`, `image-alt`, `region` |
| SHA-256 of `violation.html` | ✅ | Fingerprint of the element's outer HTML |
| CSS selector | ✅ | axe-core selector string for the node |
| Line number | ❌ | Never used — immune to line shifts |

---

## Fixture Reference

| File | Contents | Violations at baseline time |
|---|---|---|
| `tests/fixtures/baseline-a.html` | `<img>` + empty `<button>`, no landmark | `image-alt` (critical), `button-name` (critical), `region` (moderate) = **3 total** |
| `tests/fixtures/baseline-stale.html` | Same elements wrapped in `<main>` | `image-alt` (critical), `button-name` (critical) = **2 total** (no `region` — landmark present) |

---

## Test 1 — Save baseline, always exits 0

**What it proves:** `--save-baseline` snapshots all current violations and exits 0 unconditionally, regardless of violation count.

```bash
node src/index.js scan tests/fixtures/baseline-a.html --save-baseline
echo $LASTEXITCODE
```

**Expected output:**
```
✔ Baseline saved → .a11y-baseline.json
  3 violations recorded across 1 file
  Commit this file to your repository.
```

✅ Exit code: `0`

---

## Test 2 — All violations suppressed

**What it proves:** When the scanned file is identical to the baseline snapshot, every violation matches and all are suppressed. Exit 0.

```bash
node src/index.js scan tests/fixtures/baseline-a.html --save-baseline
node src/index.js scan tests/fixtures/baseline-a.html --fail-on-new
echo $LASTEXITCODE
```

**Expected terminal output:**
```
3 issues  (3 suppressed)

  BASELINE  [CRITICAL]  ...button-name
  BASELINE  [CRITICAL]  ...image-alt
  BASELINE  [MODERATE]  ...region

✓ 3 baseline violations suppressed (run --save-baseline to clean up)
```

✅ Exit code: `0`

---

## Test 3 — New violation detected in the same file

**What it proves:** A new element added after baseline was saved appears as `NEW`. The original violations remain `BASELINE`. Exit 4.

```bash
# Step 1 — save baseline from the original file
node src/index.js scan tests/fixtures/baseline-a.html --save-baseline

# Step 2 — add an unlabeled input (introduces 2 new violations: label + region@input)
node -e "const fs=require('fs'); let c=fs.readFileSync('tests/fixtures/baseline-a.html','utf8'); c=c.replace('</body>','<input type=\"text\">\n</body>'); fs.writeFileSync('tests/fixtures/baseline-a.html',c,'utf8')"

# Step 3 — scan: new violations expected
node src/index.js scan tests/fixtures/baseline-a.html --fail-on-new
echo $LASTEXITCODE

# Step 4 — restore original file
node -e "const fs=require('fs'); let c=fs.readFileSync('tests/fixtures/baseline-a.html','utf8'); c=c.replace('<input type=\"text\">\n',''); fs.writeFileSync('tests/fixtures/baseline-a.html',c,'utf8')"
```

**Expected terminal output:**
```
5 issues  (2 new · 3 suppressed)

  BASELINE  [CRITICAL]  ...button-name
  BASELINE  [CRITICAL]  ...image-alt
  BASELINE  [MODERATE]  ...region       (on img)
  NEW       [CRITICAL]  ...label        (on input)
  NEW       [MODERATE]  ...region       (on input — different selector from img)

✖ 2 new violations — pipeline blocked
✓ 3 baseline violations suppressed (run --save-baseline to clean up)
```

✅ Exit code: `4`

---

## Test 4 — Line shift does NOT break matching

**What it proves:** Prepending blank lines shifts all line numbers in the output, but matching is purely composite-key based — no line numbers — so all violations still match the baseline. Exit 0.

```bash
# Step 1 — save baseline
node src/index.js scan tests/fixtures/baseline-a.html --save-baseline

# Step 2 — prepend 10 blank lines (shifts every line number by 10)
node -e "const fs=require('fs'); let c=fs.readFileSync('tests/fixtures/baseline-a.html','utf8'); fs.writeFileSync('tests/fixtures/baseline-a.html','\n\n\n\n\n\n\n\n\n\n'+c,'utf8')"

# Step 3 — scan: violations now at lines ~15-16 instead of 5-6, should still be BASELINE
node src/index.js scan tests/fixtures/baseline-a.html --fail-on-new
echo $LASTEXITCODE

# Step 4 — restore
node -e "const fs=require('fs'); let c=fs.readFileSync('tests/fixtures/baseline-a.html','utf8'); fs.writeFileSync('tests/fixtures/baseline-a.html',c.replace(/^\n+/,''),'utf8')"
```

**Expected terminal output:**
```
3 issues  (3 suppressed)

  BASELINE  [CRITICAL]  ...button-name   (File: ...html:16 — line shifted but still BASELINE)
  BASELINE  [CRITICAL]  ...image-alt     (File: ...html:15)
  BASELINE  [MODERATE]  ...region

✓ 3 baseline violations suppressed (run --save-baseline to clean up)
```

> Line numbers in the output will be ~10 higher than at baseline save time. That is the point — the match still works because line number is not part of the key.

✅ Exit code: `0`

---

## Test 5 — "Touch it, you own it"

**What it proves:** A developer modifies the broken element (adds `class="hero"`) without fixing the a11y issue. The element's `violation.html` changes → new SHA-256 fingerprint → no match → resurfaces as `NEW`. Untouched elements remain `BASELINE`.

```bash
# Step 1 — save baseline
node src/index.js scan tests/fixtures/baseline-a.html --save-baseline

# Step 2 — add class="hero" to img (violation.html changes, issue is not fixed)
node -e "const fs=require('fs'); let c=fs.readFileSync('tests/fixtures/baseline-a.html','utf8'); c=c.replace('<img src=\"photo.jpg\">','<img src=\"photo.jpg\" class=\"hero\">'); fs.writeFileSync('tests/fixtures/baseline-a.html',c,'utf8')"

# Step 3 — scan: img violations resurface as NEW, button stays BASELINE
node src/index.js scan tests/fixtures/baseline-a.html --fail-on-new
echo $LASTEXITCODE

# Step 4 — restore
node -e "const fs=require('fs'); let c=fs.readFileSync('tests/fixtures/baseline-a.html','utf8'); c=c.replace('<img src=\"photo.jpg\" class=\"hero\">','<img src=\"photo.jpg\">'); fs.writeFileSync('tests/fixtures/baseline-a.html',c,'utf8')"
```

**Expected terminal output:**
```
3 issues  (2 new · 1 suppressed)

  BASELINE  [CRITICAL]  ...button-name
  NEW       [CRITICAL]  ...image-alt   (HTML is now: <img src="photo.jpg" class="hero">)
  NEW       [MODERATE]  ...region      (same img element, HTML changed)

✖ 2 new violations — pipeline blocked
✓ 1 baseline violation suppressed (run --save-baseline to clean up)
```

✅ Exit code: `4`

---

## Test 6 — Stale entry (fixed violation, silently ignored)

**What it proves:** When a developer actually fixes an issue that was in the baseline, the stale baseline entry is silently dropped — no warning, no failure. The remaining baseline violations stay suppressed.

Uses `baseline-stale.html` (has `<main>` to avoid `region` violations, giving a clean 2-violation baseline of `button-name` + `image-alt`).

```bash
# Step 1 — save baseline (2 violations: button-name + image-alt)
node src/index.js scan tests/fixtures/baseline-stale.html --save-baseline

# Step 2 — fix the img by adding alt text
node -e "const fs=require('fs'); let c=fs.readFileSync('tests/fixtures/baseline-stale.html','utf8'); c=c.replace('<img src=\"photo.jpg\">','<img src=\"photo.jpg\" alt=\"A photo\">'); fs.writeFileSync('tests/fixtures/baseline-stale.html',c,'utf8')"

# Step 3 — scan: image-alt is gone (stale), button-name is BASELINE
node src/index.js scan tests/fixtures/baseline-stale.html --fail-on-new
echo $LASTEXITCODE

# Step 4 — restore
node -e "const fs=require('fs'); let c=fs.readFileSync('tests/fixtures/baseline-stale.html','utf8'); c=c.replace('<img src=\"photo.jpg\" alt=\"A photo\">','<img src=\"photo.jpg\">'); fs.writeFileSync('tests/fixtures/baseline-stale.html',c,'utf8')"
```

**Expected terminal output:**
```
1 issue  (1 suppressed)

  BASELINE  [CRITICAL]  ...button-name

✓ 1 baseline violation suppressed (run --save-baseline to clean up)
```

> No error or warning about the stale `image-alt` entry. It was in the baseline, is no longer detected, and is silently ignored.

✅ Exit code: `0`

---

## Test 7 — No baseline file

**What it proves:** If `--fail-on-new` is used but no `.a11y-baseline.json` exists, the scanner emits a warning on `stderr` and continues normally without blocking the pipeline.

```bash
Remove-Item .a11y-baseline.json -ErrorAction SilentlyContinue
node src/index.js scan tests/fixtures/baseline-a.html --fail-on-new
echo $LASTEXITCODE
```

**Expected stderr:**
```
[allycat] Warning: --fail-on-new specified but no .a11y-baseline.json found. Run --save-baseline first. Continuing without baseline check.
```

**Expected stdout:** Normal violation output (no BASELINE/NEW labels).

✅ Exit code: `0`

---

## Test 8 — `--fail-on-new` beats `--fail-on-critical` when NEW violations exist

**What it proves:** Exit code 4 (new violations) takes priority over exit code 1 (critical threshold). The baseline is from a different file, so all violations in the scanned file are `NEW`.

```bash
# Save baseline from stale fixture (different file path)
node src/index.js scan tests/fixtures/baseline-stale.html --save-baseline

# Scan baseline-a.html — different path → all 3 violations are NEW
node src/index.js scan tests/fixtures/baseline-a.html --fail-on-new --fail-on-critical
echo $LASTEXITCODE
```

> `baseline-a.html` has a different absolute path than `baseline-stale.html`. File path is part of the composite key, so no entries match.

✅ Exit code: `4` (not `1`)

---

## Test 9 — Severity gate fires on baseline-suppressed violations

**What it proves:** When all violations are suppressed by the baseline (no `NEW`), exit 4 is not triggered. But `--fail-on-critical` still inspects the full violation set — including suppressed ones. Critical violations in the baseline still trigger the severity gate.

```bash
node src/index.js scan tests/fixtures/baseline-a.html --save-baseline
node src/index.js scan tests/fixtures/baseline-a.html --fail-on-new --fail-on-critical
echo $LASTEXITCODE
```

**Expected terminal output:**
```
3 issues  (3 suppressed)

  BASELINE  [CRITICAL]  ...button-name
  BASELINE  [CRITICAL]  ...image-alt
  BASELINE  [MODERATE]  ...region

✓ 3 baseline violations suppressed (run --save-baseline to clean up)
```

> No new violations → exit 4 not triggered. But `button-name` and `image-alt` are critical → `--fail-on-critical` fires → exit 1.

✅ Exit code: `1`

---

---

## Edge Case Tests

These tests probe failure modes and boundary conditions not covered by the main test suite.

---

### EC-1 — Corrupted baseline file

**What it proves:** If `.a11y-baseline.json` exists but contains invalid JSON, the scanner warns on `stderr` and continues without baseline classification — it does not crash or exit non-zero due to the parse failure.

```bash
# Write a corrupted baseline file
node -e "require('fs').writeFileSync('.a11y-baseline.json', 'NOT VALID JSON', 'utf8')"

node src/index.js scan tests/fixtures/baseline-a.html --fail-on-new
echo $LASTEXITCODE
```

**Expected stderr:**
```
[allycat] Warning: could not parse .a11y-baseline.json — treating as missing
```

**Expected stdout:** Normal violation output (no BASELINE/NEW labels — baseline was treated as missing).

✅ Exit code: `0`

---

### EC-2 — `--save-baseline` and `--fail-on-new` used together

**What it proves:** `--save-baseline` always takes the early-return path and exits 0. When both flags are passed, `--fail-on-new` is silently ignored — the save completes and no classification runs.

```bash
node src/index.js scan tests/fixtures/baseline-a.html --save-baseline --fail-on-new
echo $LASTEXITCODE
```

**Expected output:**
```
✔ Baseline saved → .a11y-baseline.json
  3 violations recorded across 1 file
  Commit this file to your repository.
```

> No BASELINE/NEW labels. No exit 4. `--fail-on-new` is never reached.

✅ Exit code: `0`

---

### EC-3 — All violations fixed, zero violations with `--fail-on-new`

**What it proves:** When the scanned file is fully clean, `--fail-on-new` does not produce a broken or empty baseline-labeled output. The scanner shows the normal "No issues found" message and exits 0.

```bash
# Save baseline from the clean fixture (0 violations)
node src/index.js scan tests/fixtures/fail-on-clean.html --save-baseline

# Scan the same clean file — 0 violations, baseline classification still runs
node src/index.js scan tests/fixtures/fail-on-clean.html --fail-on-new
echo $LASTEXITCODE
```

**Expected output:**
```
✔ No accessibility issues found!
```

> `allViolations.length === 0` → the baseline output path exits early with the clean message, not an empty table.

✅ Exit code: `0`

---

### EC-4 — Empty baseline + dirty scan target → all violations are NEW

**What it proves:** A baseline with 0 entries (saved on a clean file) does not suppress anything. Every violation in the next scan is treated as `NEW` and blocks the pipeline.

```bash
# Step 1 — save an empty baseline from the clean fixture
node src/index.js scan tests/fixtures/fail-on-clean.html --save-baseline

# Step 2 — scan a file with violations: baseline is empty, all 3 are NEW
node src/index.js scan tests/fixtures/baseline-a.html --fail-on-new
echo $LASTEXITCODE
```

**Expected terminal output:**
```
3 issues  (3 new)

  NEW  [CRITICAL]  ...button-name
  NEW  [CRITICAL]  ...image-alt
  NEW  [MODERATE]  ...region

✖ 3 new violations — pipeline blocked
```

✅ Exit code: `4`

---

## Cleanup

```bash
Remove-Item .a11y-baseline.json -ErrorAction SilentlyContinue
```

---

## Summary Table

| # | What it tests | Fixture | Extra flags | Expected exit |
|---|---|---|---|:---:|
| 1 | `--save-baseline` always exits 0 | `baseline-a.html` | `--save-baseline` | `0` |
| 2 | All violations suppressed | `baseline-a.html` | `--fail-on-new` | `0` |
| 3 | New element → NEW label + pipeline blocked | `baseline-a.html` (modified) | `--fail-on-new` | `4` |
| 4 | Line shift does not break matching | `baseline-a.html` (prepended) | `--fail-on-new` | `0` |
| 5 | HTML change → fingerprint mismatch → NEW | `baseline-a.html` (class added) | `--fail-on-new` | `4` |
| 6 | Fixed violation silently removed (stale) | `baseline-stale.html` (fixed) | `--fail-on-new` | `0` |
| 7 | Missing baseline file → warning, no block | `baseline-a.html` | `--fail-on-new` | `0` |
| 8 | Exit 4 takes priority over exit 1 | `baseline-a.html` (cross-file baseline) | `--fail-on-new --fail-on-critical` | `4` |
| 9 | Severity gate still runs on suppressed violations | `baseline-a.html` | `--fail-on-new --fail-on-critical` | `1` |
| EC-1 | Corrupted baseline → warning + no crash | `baseline-a.html` | `--fail-on-new` | `0` |
| EC-2 | `--save-baseline` wins over `--fail-on-new` | `baseline-a.html` | `--save-baseline --fail-on-new` | `0` |
| EC-3 | 0 violations + `--fail-on-new` → clean message | `fail-on-clean.html` | `--fail-on-new` | `0` |
| EC-4 | Empty baseline → all violations NEW | `fail-on-clean.html` → `baseline-a.html` | `--fail-on-new` | `4` |

> Each test that modifies a fixture includes a restore step. Always run restore before the next test.

---

## Implementation Reference

| Concern | Location |
|---|---|
| Composite key + fingerprinting | `src/utils/baselineManager.js` — `fingerprint()`, `classifyViolations()` |
| Save baseline entry point | `src/commands/scanResultHandler.js:28-36` |
| Load + classify entry point | `src/commands/scanResultHandler.js:40-47` |
| Exit 4 priority logic | `src/commands/scanResultHandler.js:52-54` |
| Severity gate | `src/commands/scanResultHandler.js:57` → `exitOnThreshold()` |
| Terminal output with labels | `src/commands/scanOutputters.js` — `outputTerminalWithBaseline()` |
