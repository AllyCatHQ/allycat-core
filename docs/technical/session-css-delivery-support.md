# Technical Session Summary — CSS Delivery Support
**Date:** 01.03.2026 | **Project:** AllyCat Core | **Session type:** Feature implementation

---

## 1. Executive Summary

This session extended AllyCat Core's full scanner (Playwright-based) to correctly detect CSS-driven contrast violations across all supported file types. Before this session, CSS was only reliably injected for JSX/TSX files (via ESM `import` statements) and HTML files (via `<link rel="stylesheet">`). Vue SFC style blocks, Angular component styles, and transitively-imported CSS were silently discarded — meaning Playwright rendered those components with no CSS and axe-core never reported contrast violations.

### Features implemented

| # | Feature | Root Cause (before) | Files Changed |
|---|---|---|---|
| F1 | Vue `<style>` / `<style scoped>` extraction | `vueTransformer.js` only read `<template>` | `vueTransformer.js`, `cssResolver.js`, `fullScanner.js` |
| F2 | Transitive `@import` inside CSS files | `loadCssFiles()` loaded files but never parsed `@import` directives inside them | `cssResolver.js` |
| F3 | Angular `styleUrls` + `styles[]` array | `angularTsExtractor.js` discarded component metadata after template extraction | `angularTsExtractor.js`, `fullScanner.js` |

### Infrastructure built alongside

- **9 test fixture files** — one per delivery method, each with at least 2 contrast-failing and 2 contrast-passing elements
- **`tests/e2e/css-delivery.test.js`** — structured test runner with `assert()` (active) and `markPending()` (future) states, organized by feature
- **`docs/Css-Delivery-support/01.03.2026.md`** — updated support matrix snapshot

### Final test result
```
9/9 active tests passed  |  2 pending (CSS Modules, print-media filter)
```

---

## 2. Challenges & Solutions

### Challenge 1 — Bridging the transformer → injector gap (Feature 1)

**Problem:** `vueTransformer.js` returned `{ html, lineMap, ordinalIndex }` but no CSS. The CSS pipeline (`resolvAndInjectCss`) only handled CSS *file paths* — it had no way to accept already-resolved CSS strings directly.

**Solution:** Added an optional `extraCssStrings = []` parameter to `resolvAndInjectCss`. This is a backward-compatible extension — all existing callers pass nothing and get the old behavior. The `fullScanner.js` builds this array per file type:

```js
let extraCss = [];
if (isVue)        extraCss = extractStyleBlocks(sourceContent);
else if (isAngularTs) { /* load styleUrls + inline styles */ }
// JSX / HTML: extraCss stays [] — zero change
```

**Why this matters architecturally:** The `extraCss` parameter keeps the *injection step* unified in one place (`injectCssIntoHtml`) while allowing different file types to contribute CSS through different extraction pipelines.

---

### Challenge 2 — Diamond dependency and infinite recursion (Feature 2)

**Problem:** When implementing transitive `@import` resolution recursively, consider this structure:
```
layout.css  →  @import './base.css'
theme.css   →  @import './base.css'
app.js      →  import './layout.css'
            →  import './theme.css'
```
Naively recursing would load `base.css` twice (duplicated rules) or, in a circular case, loop forever.

**Solution:** Added a `_visited = new Set()` parameter (internal, prefixed with `_` to signal callers should never pass it). Before processing any CSS file:
```js
if (_visited.has(absolutePath)) continue;  // O(1) lookup
_visited.add(absolutePath);
```
The Set is shared across the entire recursive call tree for one file's scan, preventing both duplicates and infinite loops. Each file scan gets a fresh Set — so `base.css` can still be injected for multiple files in the same run, just not twice within one file's dependency tree.

---

### Challenge 3 — `]` inside CSS attribute selectors breaking regex (Feature 3)

**Problem:** A simple regex like `/styles\s*:\s*\[([^\]]*)\]/` stops at the first `]` it finds. But CSS rules frequently contain attribute selectors:
```ts
styles: ['.input[type="text"] { border: 1px solid; }']
```
The `[type="text"]` part contains a `]` that would terminate the match early, returning malformed content.

**Solution:** A character-by-character bracket-depth scanner for `extractInlineStyles()`:
```
depth=1 when we enter the outer [
depth increases on every [ (unless inside a string)
depth decreases on every ] (unless inside a string)
we stop when depth reaches 0
```
String boundaries (single, double, backtick) are tracked separately so `]` characters inside string literals are ignored. This is still O(S) — exactly one pass through the source.

**Contrast with `extractStyleUrls`:** CSS file paths cannot contain `]`, so the simple regex is correct and preferred there — no need for the heavier scanner.

---

### Challenge 4 — CSS cascade order for transitive imports

**Problem:** CSS cascade rules dictate that when `@import './colors.css'` appears inside `theme.css`, the rules from `colors.css` must apply *before* the rules in `theme.css` (earlier in the stylesheet = lower specificity, later rules win). If we appended transitive content *after* the parent file's content, specificity would be reversed.

**Solution:** In `loadCssFiles`, nested content is pushed to `contents` *before* the current file:
```js
const nested = await loadCssFiles(transitivePaths, resolvedCache, _visited);
contents.push(...nested);   // colors.css first
contents.push(content);      // theme.css after
```
This mirrors how browsers process `@import` — the imported file's rules are logically inserted at the `@import` line, which is always before the rest of the file.

---

## 3. Alternative Analysis

### Why `extraCssStrings` param vs. a separate injection pass

**Alternative:** After calling `resolvAndInjectCss`, call `injectCssIntoHtml` again with the Vue/Angular extras. This would be two separate `</head>` injections.

**Why we didn't:** Two injection calls means two `replace('</head>', ...)` operations. The second call would need to find the already-modified HTML string. More importantly, it couples the caller to internal HTML structure. A single injection keeps the contract clean: one call, one `<style>` block in `<head>`.

---

### Why recursive `loadCssFiles` vs. a pre-pass CSS crawler

**Alternative:** Before scanning any files, crawl the project and build a full map of all CSS import relationships. Then inject all reachable CSS for each file.

**Why we didn't:** A pre-pass would require reading every CSS file in the project regardless of whether it's reachable from the files being scanned. The lazy recursive approach reads only the CSS files actually reachable from each source file. Combined with the shared `resolvedCache` (disk reads memoized across the whole scan run), the total disk I/O is still bounded to the number of unique CSS files in the dependency graph.

---

### Why a bracket scanner vs. a proper TypeScript/Babel AST parser for Angular styles

**Alternative:** Use Babel or the TypeScript compiler API to parse the `.component.ts` file and extract `styles` as an AST array expression.

**Why we didn't:** The project is a static analysis tool with no build step. Pulling in a full TS parser for one metadata key adds significant startup time and dependency weight. The bracket scanner is ~30 lines of vanilla JS, handles the real-world cases correctly, and fails gracefully (returns `[]`) on malformed input. The TypeScript AST approach would be warranted if we needed to resolve template expressions or handle computed property names — but `styles` is always a static array of string literals.

---

### Why `_visited` Set instead of memoizing in `resolvedCache`

**Alternative:** Use the existing `resolvedCache` (which already stores processed content) to detect duplicates — if a path is in the cache, skip transitive processing.

**Why we didn't:** `resolvedCache` is shared *across all files* in a scan run. Marking a file as visited there would prevent its transitive imports from being resolved for a *different* file later in the same run. `_visited` is scoped to a single file's dependency tree, which is the correct boundary.

---

## 4. Developer's Glossary

| Term | Definition |
|---|---|
| **SFC (Single File Component)** | Vue's `.vue` file format — combines `<template>`, `<script>`, and `<style>` blocks in one file |
| **`<style scoped>`** | Vue attribute that tells the Vue compiler to generate a unique hash for each CSS class, limiting styles to the current component only. In our scanner we extract the raw CSS as-is — the hash is a build-time detail irrelevant for a11y scanning |
| **`<style module>`** | Vue CSS Modules — class names are replaced with generated hashes at compile time. The `:class="$style['name']"` binding renders as `class="dynamic"` in our static transform, so injected rules never match the element |
| **`styleUrls`** | Angular `@Component` metadata key — array of relative paths to external CSS files used by this component |
| **`styles[]`** | Angular `@Component` metadata key — array of inline CSS string literals embedded directly in the TypeScript source |
| **Transitive `@import`** | A CSS `@import` directive inside a CSS file that is itself loaded from an import. `app.js → theme.css → @import './colors.css'` — `colors.css` is the transitive dependency |
| **Diamond dependency** | A dependency graph where two different parents both depend on the same child. `A → B, A → C, B → D, C → D`. Without a visited-Set guard, D would be processed twice |
| **Cycle guard / visited Set** | A `Set<path>` used during recursive traversal to detect and skip already-visited nodes, preventing infinite loops from circular `@import` chains |
| **axe-core** | The open-source accessibility rules engine behind most automated a11y tools. Runs inside Playwright's browser context and reports WCAG violations via DOM inspection |
| **Playwright** | Microsoft's browser automation library. Used in AllyCat's full scan mode to launch a real Chromium instance, render HTML with full CSS, and let axe compute computed color values for contrast checking |
| **JSDOM** | A Node.js DOM implementation that parses HTML without a real browser. Used in quick scan mode — cannot compute layout or contrast because there is no rendering engine |
| **`resolvAndInjectCss()`** | AllyCat's central CSS pipeline function in `cssResolver.js`. Takes transformed HTML + source content + file path + cache + extraCssStrings → returns HTML with a `<style>` block injected before `</head>` |
| **`extraCssStrings`** | The new optional parameter added to `resolvAndInjectCss`. Accepts already-resolved CSS text (Vue style blocks, Angular inline styles) that bypasses the file-loading pipeline and goes directly to injection |
| **Bracket-depth scanner** | A character-by-character state machine that counts opening/closing brackets while tracking string boundaries. Used to safely extract array content from Angular `styles: [...]` without regex failing on `]` inside CSS attribute selectors |
| **CSS cascade order** | The rule that later declarations in a stylesheet win over earlier ones when specificity is equal. Transitive imports must be prepended (come first) so the parent file's rules correctly override them |
| **O(S) / O(F×C)** | Big-O notation. O(S) = linear in source file size. O(F×C) = linear in total CSS file content (F files × C avg content). All our extraction functions are O(S) — no quadratic or exponential behavior |
| **`_visited` naming convention** | Leading underscore signals an internal/private parameter. In JS/TS, there is no language-level private for function params — the `_` is a documentation convention meaning "caller should never pass this" |

---

## 5. Topics for Further Study

### CSS & Browser Internals
- **CSSOM (CSS Object Model)** — how browsers parse and represent stylesheets internally; why contrast can only be computed after layout
- **CSS specificity and cascade rules** — understand the full algorithm (origin, specificity, order) to reason about why CSS order matters when injecting multiple stylesheets
- **CSS `@import` vs `<link>`** — performance implications in real browsers (blocking vs. parallel), and why `@import` is generally discouraged in production

### JavaScript / Node.js Patterns
- **Recursive algorithms with memoization vs. cycle detection** — the difference between a `resolvedCache` (memoize results) and a `_visited` Set (prevent revisiting in the *current* traversal), and when each is appropriate
- **State machines in string parsing** — the bracket-depth scanner used in `extractInlineStyles` is a minimal finite-state machine. Study FSMs formally to handle more complex parsing needs
- **Default function parameters and backward compatibility** — how `param = defaultValue` in JS allows extending a function signature without breaking existing callers

### Accessibility
- **WCAG 2.1 contrast ratio algorithm** — the mathematical formula behind the 4.5:1 minimum (relative luminance calculation). Understanding this helps reason about which colors will pass or fail
- **axe-core rule IDs** — learn the `color-contrast`, `color-contrast-enhanced` (AAA), and other relevant rule IDs to better interpret scan output

### Architecture & Testing
- **Separation of concerns in pipelines** — this session's design (extract → resolve → load → inject) is a classic pipeline pattern. Study pipeline/middleware patterns (Node.js streams, Express middleware, Unix pipes) to recognize and apply them
- **Test fixture design** — how to write test fixtures that are *self-documenting* (the fixture explains what it tests), *minimal* (no noise violations), and *deterministic* (always produce the same result)
- **Regression testing** — why keeping "baseline" tests (ContrastCssTest.jsx) alongside new tests is critical: they catch when a new feature accidentally breaks an old one

---

*Generated at end of session · AllyCat Core v0.9 pre-launch*
