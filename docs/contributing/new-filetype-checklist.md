# New File Type Support — Checklist

Every time a new file type is added to AllyCat, go through every item below.
Each section explains WHY it matters, not just what to do.

---

## 1. Transformer Output Contract

**File:** `src/engine/transformers/<framework>Transformer.js`

The transformer MUST return exactly:
```js
{ html: string, lineMap: Map<number, number>, ordinalIndex: Map<string, number[]> }
```

- `html` — valid HTML string that JSDOM/Playwright can parse
- `lineMap` — `Map<htmlLine, sourceFileLine>` (1-indexed). Used by Layer B resolver.
- `ordinalIndex` — `Map<tagName, [sourceLine, sourceLine, ...]>` in document order.
  Used by Layer A resolver to resolve line numbers for identical elements.

**Why ordinalIndex matters:** Without it, multiple identical elements (e.g. four bare
`<button></button>`) all resolve to line 1 — the scanner can only find the first match.
Layer A uses DOM ordinal position to find the Nth occurrence of a tag and looks up its
line in this index.

**Important:** The HTML wrapper adds boilerplate lines around the component fragment.
If you wrap the output (like JSX does with `<html><body>…`), account for the line offset
in `HTML_WRAPPER_OFFSET` so `lineMap` entries stay accurate.

---

## 2. Duplicate Element Line Resolution (Ordinal Index)

**Files:** `src/engine/violations/violationProcessor.js`, `src/utils/sourceMapper.js`

This is the most subtle bug to introduce and the hardest to notice in testing.

When multiple elements have identical HTML snippets (same tag, no attributes), all
violations for that tag resolve to the first line in the file because `findLineNumber`
uses text search and returns the first match.

**For component files (JSX/Vue/Angular):** The transformer must build `ordinalIndex`
correctly. Each opening tag encountered while walking the AST/template adds a source
line entry to `ordinalIndex.get(tagName)` in document order.

**For plain HTML files:** `buildHtmlOrdinalIndex()` in `sourceMapper.js` is called by
`quickScanner.js` to build the same structure from raw source. Always pass
`ordinalIndex` and `window.document` to `processAxeViolations` — never null for HTML.

**How to test:** Create a fixture with 3+ identical elements (e.g. three `<button></button>`
on separate lines). Run `allycat scan <fixture>` and verify each violation shows a
distinct line number, not all the same.

---

## 3. CSS Delivery Method for Contrast (`--full`)

**File:** `src/engine/transformers/transformerUtils.js` → `detectCssInJs()`

Full scan uses Playwright/Chromium to compute real color contrast. This only works if
styles are delivered via stylesheets (external CSS, `<style>` blocks, or inline `style=`
attributes). It does NOT work for CSS-in-JS.

For any new file type, determine whether it commonly uses CSS-in-JS:
- **Styled Components / Emotion / Stitches** — JS-injected, contrast unavailable
- **CSS Modules** — compiled to class names, works fine in full scan
- **Tailwind / utility classes** — stylesheet-based, works fine
- **Inline styles via framework binding** — works fine (style attr is preserved)

**Action:**
1. If the framework has a CSS-in-JS pattern, add its import signature to `detectCssInJs()`
   in `transformerUtils.js` so the scanner can warn the user.
2. The warning message is shown in the scan output. Do NOT silently ignore it.

**Current detections:** `styled-components`, `@emotion/react`, `@emotion/styled`,
`@stitches/react`, `styled-jsx/css`, `@stitches/core`

---

## 4. Dynamic Attribute Bindings

Different frameworks express dynamic/computed attributes differently:
- JSX: `aria-label={variable}`, `:alt` is NOT valid (React uses camelCase)
- Vue: `:aria-label="variable"`, `v-bind:alt="variable"`
- Angular: `[attr.aria-label]="variable"`, `[alt]="variable"`

**The problem:** If the transformer emits these as-is, JSDOM sees them as unknown
attributes. Axe-core may then flag violations (e.g. "img missing alt") when the alt IS
present at runtime — a false positive.

**The fix:** The transformer must normalize dynamic bindings to a static placeholder:
- Dynamic alt → `alt="dynamic"` (or `alt="[dynamic]"`)
- Dynamic aria-label → `aria-label="dynamic"`

The token `"dynamic"` is intentionally excluded from unique-attribute search in
`violationProcessor.js` (`extractUniqueAttributeToken`) to prevent false line matches.

**How to test:** The edge-cases fixture (see section 8) must include at least one
dynamic attribute binding and verify no false positive is raised for it.

---

## 5. Document-Level Rule Filtering

**File:** `src/engine/violations/violationProcessor.js` → `DOCUMENT_LEVEL_RULES`

Component files are fragments, not full HTML documents. Axe-core will flag rules like:
- `landmark-one-main` — no `<main>` in a button component
- `page-has-heading-one` — no `<h1>` in a card component
- `html-has-lang` — no `<html lang>` in a modal component
- `region` — content not inside a landmark in a component fragment
- `document-title`, `meta-viewport`, `bypass`

These are false positives for component files.

**Action:** Any file type that produces component fragments (not full pages) must pass
`isComponent = true` so `processAxeViolations` skips `DOCUMENT_LEVEL_RULES`.
Check `quickScanner.js` — the `isComponent` flag controls this.

**Exception:** If a framework file is always a full page (e.g. a Next.js `_document.tsx`),
treat it as non-component.

**Custom components in structural parents:** When a transformer renders a custom component
(uppercase tag name) that is a direct child of a structural parent (`<ul>`, `<ol>`, `<dl>`,
`<table>`, etc.), substitute its tag for the structurally valid child (`<li>`, `<div>`,
`<tr>`, …) so axe-core sees valid HTML and never fires a false list-structure violation.
See `PARENT_CHILD_DEFAULTS` in `jsxRenderer.js` for the reference mapping. Do **not** emit a
synthetic marker attribute — substitution alone prevents the false positive, and hand-written
HTML (which is not substituted) is still flagged correctly.

---

## 6. `SUPPORTED_EXTENSIONS` Constant

**File:** `src/constants.js`

Add the new extension to `SUPPORTED_EXTENSIONS`. This array controls:
- `fileResolver.js` — which files are discovered by glob
- `watchMode.js` — which file changes trigger a rescan

If you forget this, the scanner silently skips all files of the new type.

---

## 7. RTL Compliance

**File:** `src/engine/violations/rtlValidator.js`

If the new file type is a component (fragment), use `checkJsxRtlCompliance()`.
If it is a full HTML document, use `checkRtlCompliance()`.

Check how the existing scanners call the RTL validator and replicate the pattern.
RTL violations are appended after axe-core violations — they don't go through the
standard violation pipeline.

---

## 8. Test Fixtures (Required — Two Files)

**Directory:** `tests/fixtures/`

Always create TWO fixture files:

**`sample.<ext>`** — general fixture with realistic content and 2–4 intentional
a11y violations (missing alt, empty button, input without label, etc.).

**`<framework>-edge-cases.<ext>`** — dedicated edge-cases fixture. Must include:
- Nested elements (e.g. `<button>` inside `<a>`, `<div>` inside `<label>`)
- Dynamic attribute bindings (`[attr.aria-label]`, `:alt`, `{variable}`) — verify
  NO false positive is raised for these
- At least two intentional violations to confirm real issues are still caught
- Self-closing tags if relevant to the framework

**Encoding:** On this Windows machine, the Write tool produces UTF-16 LE which breaks
JSDOM. Always create fixture files with Node:
```bash
node -e "require('fs').writeFileSync('path/to/file.html', '<content>', 'utf8')"
```

Run the scanner on BOTH fixtures before committing. Verify line numbers, violation
counts, and that no false positives appear for dynamic bindings.

---

## 9. Help Content & README

**Files:** `src/commands/helpContent.js`, `README.md`

Every new file type must appear in:
- The "Supported file types" list in `helpContent.js` (shown in `--help` output)
- The "Supported file types" section in `README.md`

If the file type has framework-specific scan behavior (e.g. `.component.ts` inline
templates, CSS-in-JS warning), document that behavior too.

---

## 10. fileResolver.js — Discovery Rules

**File:** `src/utils/fileResolver.js`

Check whether the new extension needs special discovery logic:
- Some extensions are ambiguous (e.g. `.ts` could be Angular or plain TypeScript)
- Angular uses `.component.ts` — the scanner inspects file content to confirm
- If your framework has a naming convention (e.g. `.page.vue`, `.stories.jsx`), decide
  whether those should be included or excluded

The resolver uses glob + `SUPPORTED_EXTENSIONS` by default. Content-based detection
is done inside the scanner, not the resolver.

---

## 11. `fullScanner.js` Parity

**File:** `src/engine/scanners/fullScanner.js`

Every transformer integration done in `quickScanner.js` must be replicated in
`fullScanner.js`. The two scanners must support exactly the same file types.

Common places to sync:
- Import the transformer
- Add the `isXxx` / `isComponent` detection block
- Pass `ordinalIndex` and the relevant document context to `processAxeViolations`

---

## Quick Reference — Files Changed for Every New Type

| File | What to do |
|------|-----------|
| `src/constants.js` | Add extension to `SUPPORTED_EXTENSIONS` |
| `src/engine/transformers/<name>Transformer.js` | New transformer: return `{html, lineMap, ordinalIndex}` |
| `src/engine/scanners/quickScanner.js` | Import transformer, add detection + scan branch |
| `src/engine/scanners/fullScanner.js` | Same as quickScanner |
| `src/utils/transformerUtils.js` | Add CSS-in-JS import signature if applicable |
| `src/commands/helpContent.js` | Add to supported types list |
| `README.md` | Add to supported types list |
| `tests/fixtures/sample.<ext>` | General fixture |
| `tests/fixtures/<framework>-edge-cases.<ext>` | Edge-cases fixture |
