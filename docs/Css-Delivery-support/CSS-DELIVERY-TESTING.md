# CSS Delivery Support — Testing Guide

> **Scope:** Full scan only (`--full`).
> Quick scan uses JSDOM — it has no rendering engine and cannot compute contrast.
> All tests below require Playwright + Chromium.

---

## Prerequisites

```bash
# 1. Install Playwright's Chromium browser (one-time setup)
npx playwright install chromium

# 2. Make sure a config file exists in the project root
node src/index.js init
# Answer the prompts — scanMode can be left as 'quick'; --full overrides it at runtime.
```

---

## How the Tests Work

Every CSS delivery fixture is built on the same principle:

| CSS correctly injected? | What Playwright sees | axe result | Exit code |
|---|---|---|---|
| ✅ Yes | Elements with contrast-failing classes | 2 `color-contrast` violations | `3` (--fail-on-any) |
| ❌ No | Elements use browser defaults (black on white) | 0 violations | `0` |

**Exit code 3 = success** for almost every test (it proves CSS reached Playwright).
**Exit code 0 = success** only for the print-media filter test (it proves print CSS was blocked).

---

## 1. Quick Test — Run Everything at Once

```bash
node tests/e2e/css-delivery.test.js
```

### Expected output

```
── Feature 1: Vue <style> / <style scoped> extraction ──────────────
  ✅  inline-style.vue:   <style> block injected        → violations found
  ✅  scoped-style.vue:   <style scoped> block injected → violations found
  ✅  module-style.vue:   <style module> $style[] class resolved → violations found
  ✅  external-import.vue: import ./external.css        → violations found  [baseline]

── Feature 2: Transitive @import inside CSS files ──────────────────
  ✅  TransitiveJsx.jsx:  import theme.css → @import colors.css → violations found
  ✅  transitive.html:    <link> theme.css  → @import colors.css → violations found
  ✅  transitive.vue:     import theme.css → @import colors.css → violations found

── Feature 3: Angular styleUrls & inline styles[] ──────────────────
  ✅  style-urls.component.ts:   styleUrls: [./style-urls.component.css] → violations found
  ✅  inline-styles.component.ts: styles: [...CSS strings...]             → violations found

── Feature 4: <link media="print"> filtering ────────────────────────
  ✅  print-media.html:   print CSS must NOT be injected → no violations (exit 0)

── Feature 5: Custom alias resolution (tsconfig.json paths) ─────────
  ✅  TsAliasJsx.jsx:  import @test-theme/contrast-fail.css → violations found

── Regression: JSX external CSS import ─────────────────────────────
  ✅  ContrastCssTest.jsx: import ./ContrastCssTest.css  → violations found  [baseline]

── Feature 6: CSS Modules (import s from *.module.css) ─────────────
  ✅  CssModulesTest.jsx: className={s.failGray} + {s["fail-yellow"]} → violations found

── Feature 7: npm package CSS (bare specifier imports) ──────────────
  ✅  NpmCssTest.jsx:  import test-fail-colors/fail.css → violations found

── Feature 8: Angular CSS Modules ───────────────────────────────────
  ✅  css-modules.component.ts: [class]="styles.failGray" + styles['fail-yellow'] → violations found

  15/15 tests passed
```

If any test shows `❌` it will also print `expected exit 3, got 0` (or vice versa), which pinpoints the exact broken feature.

---

## 2. Manual Tests — Per Feature

Run each command individually. Full scans take ~5–10 seconds per file.

---

### Feature 1 — Vue `<style>` extraction

**What it proves:** `vueTransformer.js` extracts `<style>`, `<style scoped>`, and `<style module>` blocks and passes them to Playwright.

```bash
# Plain <style> block
node src/index.js scan tests/samples/vue/css-delivery/inline-style.vue --full

# <style scoped> block
node src/index.js scan tests/samples/vue/css-delivery/scoped-style.vue --full

# <style module> with $style['name'] class binding
node src/index.js scan tests/samples/vue/css-delivery/module-style.vue --full

# Vue import './external.css' in <script> (baseline)
node src/index.js scan tests/samples/vue/css-delivery/external-import.vue --full
```

**Success for all 4:**
```
color-contrast  ·  serious
  .vue-fail-gray   — #cccccc on #ffffff — ratio ~1.6:1  (required: 4.5:1)
  .vue-fail-yellow — #ffff00 on #ffffff — ratio ~1.07:1 (required: 4.5:1)
```
✅ **2 `color-contrast` violations visible** in each scan output.
❌ **0 violations** = CSS was not injected (feature broken).

---

### Feature 2 — Transitive `@import` inside CSS files

**What it proves:** When a loaded `.css` file contains an `@import`, that nested file is also loaded recursively.

```bash
# JSX: imports theme.css which @imports colors.css
node src/index.js scan tests/samples/css-transitive/TransitiveJsx.jsx --full

# HTML: <link href="theme.css"> which @imports colors.css
node src/index.js scan tests/samples/css-transitive/transitive.html --full

# Vue: import './theme.css' which @imports colors.css
node src/index.js scan tests/samples/css-transitive/transitive.vue --full
```

**Success for all 3:**
- The contrast-failing rules live in `colors.css` (the transitive file), not in `theme.css`.
- If you see 2 `color-contrast` violations → the transitive chain was resolved.
- If you see 0 violations → `theme.css` was loaded but `@import` inside it was ignored.

✅ **2 `color-contrast` violations visible** in each scan output.

---

### Feature 3 — Angular `styleUrls` and `styles[]`

**What it proves:** Angular component CSS metadata is read and passed to Playwright.

```bash
# styleUrls: ['./style-urls.component.css']
node src/index.js scan tests/samples/angular/css-delivery/style-urls.component.ts --full

# styles: ['.ang-fail-gray { color: #ccc; }', ...]
node src/index.js scan tests/samples/angular/css-delivery/inline-styles.component.ts --full
```

**Success for both:**

✅ **2 `color-contrast` violations visible** in each scan output.
❌ **0 violations** = `styleUrls` or `styles[]` metadata was discarded.

---

### Feature 4 — `<link media="print">` filtering

**What it proves:** Print-only stylesheets are blocked and never injected into the screen render.

```bash
node src/index.js scan tests/samples/html/print-media.html --full
```

**Success:**
```
No violations found.
```
✅ **0 violations** = print CSS was correctly filtered out.
❌ **2 `color-contrast` violations** = print CSS was incorrectly injected into the screen render.

> Note: This test is the **inverse** of all others — violations = failure, clean = success.

---

### Feature 5 — Custom alias resolution via `tsconfig.json`

**What it proves:** `compilerOptions.paths` entries in `tsconfig.json` are read and used to resolve non-standard import aliases.

```bash
node src/index.js scan tests/samples/tsconfig-alias/TsAliasJsx.jsx --full
```

The fixture imports `@test-theme/contrast-fail.css`. The alias `@test-theme/` is defined in `tests/samples/tsconfig-alias/tsconfig.json`.

✅ **2 `color-contrast` violations visible** = alias was resolved, CSS loaded.
❌ **0 violations** = alias was not resolved, import silently dropped.

---

### Regression — JSX external CSS import (baseline)

**What it proves:** The original JSX `import './file.css'` (side-effect import) still works after all newer features were added. Nothing regressed.

```bash
node src/index.js scan tests/samples/react/jsx/ContrastCssTest.jsx --full
```

✅ **3 `color-contrast` violations visible** (this fixture has 3 failing elements).
❌ **0 violations** = regression in JSX CSS loading.

---

### Feature 6 — CSS Modules (`import s from '*.module.css'`)

**What it proves:** Default CSS Module imports are resolved — `className={s.failGray}` is statically mapped to `class="failGray"` so the injected CSS rules match the element.

```bash
node src/index.js scan tests/samples/react/jsx/CssModulesTest.jsx --full
```

The fixture uses both dot notation (`s.failGray`) and bracket notation (`s["fail-yellow"]`).

✅ **2 `color-contrast` violations visible.**
❌ **0 violations** = CSS Module binding was not resolved (`class="dynamic"` in transformed HTML, injected CSS rules never matched).

---

### Feature 7 — npm package CSS (bare specifier imports)

**What it proves:** Imports like `import 'package-name/path/to/file.css'` are resolved by looking in `node_modules/`.

```bash
node src/index.js scan tests/samples/npm-css/NpmCssTest.jsx --full
```

The fixture imports `'test-fail-colors/fail.css'` — a locally committed fake package at `tests/samples/npm-css/node_modules/test-fail-colors/fail.css`.

✅ **2 `color-contrast` violations visible.**
❌ **0 violations** = npm package resolution failed, import was silently dropped.

---

### Feature 8 — Angular CSS Modules

**What it proves:** Angular components can use `import styles from '*.module.css'` with `[class]="styles.prop"` and `[ngClass]="styles.prop"` bindings — both dot notation and bracket notation are resolved.

```bash
node src/index.js scan tests/samples/angular/css-delivery/css-modules.component.ts --full
```

✅ **2 `color-contrast` violations visible.**
❌ **0 violations** = CSS Module bindings not resolved in Angular transformer.

---

## 3. CSS-in-JS Warning Check

Six runtime CSS-in-JS libraries are detected. The scanners emit a warning instead of silently failing.

**Detected libraries:** `styled-components`, `@emotion/react`, `@emotion/styled`, `@emotion/css`, `styled-jsx/css`, `@stitches/react`

```bash
# Covers styled-components
node src/index.js scan tests/samples/css-in-js/StyledComponentsTest.jsx

# Covers styled-jsx/css and @stitches/react (warning shows first match: styled-jsx/css)
node src/index.js scan tests/samples/css-in-js/CssInJsExtraLibsTest.jsx
```

**Expected output for each:**
```
▲ CSS-in-JS detected (<lib>) — contrast checking unavailable even with --full. Render to a static HTML snapshot for accurate results.
```

The scan should still **complete and report non-contrast violations** (img missing alt, unlabelled inputs, etc.). Only contrast checking is affected.

> Note: Only one warning fires per file — `detectCssInJs()` returns the first matched library. This is by design.

---

## 4. Quick Scan Smoke-Check

Quick scan intentionally skips all CSS (JSDOM cannot compute contrast). Run any fixture — it should return clean even though the file has contrast-failing CSS:

```bash
node src/index.js scan tests/samples/vue/css-delivery/inline-style.vue
# No --full flag → uses quick scan
```

**Expected:** 0 contrast violations. Any contrast violations appearing in quick scan mode would be a false positive.

---

## Summary Table

| Test | Command | Expected violations | Success criteria |
|---|---|:---:|---|
| Feature 1 — Vue `<style>` | `scan inline-style.vue --full` | 2 | color-contrast × 2 |
| Feature 1 — Vue `<style scoped>` | `scan scoped-style.vue --full` | 2 | color-contrast × 2 |
| Feature 1 — Vue `<style module>` | `scan module-style.vue --full` | 2 | color-contrast × 2 |
| Feature 1 — Vue external import | `scan external-import.vue --full` | 2 | color-contrast × 2 |
| Feature 2 — Transitive JSX | `scan TransitiveJsx.jsx --full` | 2 | color-contrast × 2 |
| Feature 2 — Transitive HTML | `scan transitive.html --full` | 2 | color-contrast × 2 |
| Feature 2 — Transitive Vue | `scan transitive.vue --full` | 2 | color-contrast × 2 |
| Feature 3 — Angular styleUrls | `scan style-urls.component.ts --full` | 2 | color-contrast × 2 |
| Feature 3 — Angular styles[] | `scan inline-styles.component.ts --full` | 2 | color-contrast × 2 |
| Feature 4 — Print media filter | `scan print-media.html --full` | **0** | **no violations** |
| Feature 5 — tsconfig alias | `scan TsAliasJsx.jsx --full` | 2 | color-contrast × 2 |
| Regression — JSX external CSS | `scan ContrastCssTest.jsx --full` | 3 | color-contrast × 3 |
| Feature 6 — JSX CSS Modules | `scan CssModulesTest.jsx --full` | 2 | color-contrast × 2 |
| Feature 7 — npm package CSS | `scan NpmCssTest.jsx --full` | 2 | color-contrast × 2 |
| Feature 8 — Angular CSS Modules | `scan css-modules.component.ts --full` | 2 | color-contrast × 2 |

> All paths above are relative to the project root. Prepend `tests/samples/` and the appropriate subdirectory as shown in the per-feature commands.

**All 15 tests automated:** `node tests/e2e/css-delivery.test.js` → `15/15 tests passed`
