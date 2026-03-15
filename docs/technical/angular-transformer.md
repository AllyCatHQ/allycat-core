# Session Technical Summary — AllyCat Core
**Date:** 2026-03-01  
**Session Focus:** P-5 — Angular Transformer

---

## Executive Summary

This session completed **P-5 of the v0.9 pre-launch roadmap**: full Angular template support for the AllyCat CLI accessibility scanner.

### What was added
| File | Type | Purpose |
|---|---|---|
| `src/engine/transformers/transformerUtils.js` | New | Shared utilities (`wrapInDocument`, `escapeAttr`, `HTML_TAGS`) extracted from duplicate code across JSX and Vue transformers |
| `src/engine/transformers/angularTransformer.js` | New | Two-pass Angular HTML transformer — strips Angular 17+ control flow blocks, cleans binding syntax, maps Angular elements to HTML equivalents |
| `src/engine/transformers/angularTsExtractor.js` | New | Extracts inline `template:` strings from `.component.ts` files with correct line offset tracking |
| `tests/fixtures/sample.component.html` | New | General Angular template scan fixture |
| `tests/fixtures/sample.component.ts` | New | Angular inline template fixture |
| `tests/fixtures/angular-edge-cases.component.html` | New | Dedicated edge-case fixture covering all Angular syntax paths |

### What was modified (surgical edits only)
- `jsxTransformer.js` / `vueTransformer.js` — removed duplicated `wrapInDocument`, `HTML_TAGS`, `escapeAttr`; now import from `transformerUtils.js`
- `quickScanner.js` / `fullScanner.js` — added Angular detection and transform branch alongside existing JSX/Vue branches
- `fileResolver.js` — added `component.ts` to `SUPPORTED_EXTENSIONS` for Angular inline template discovery; fixed extension check to use `basename` matching
- `CLAUDE.md` — added two new standing rules about edge-case fixtures for future transformer work

### What was documented (standing rules)
- Every new transformer requires **two fixture files**: a general sample and a dedicated edge-cases file
- Edge-cases fixture must include: nested elements, dynamic attribute bindings, and at least two intentional violations

---

## Challenges & Solutions

### Challenge 1 — Angular templates look like HTML but aren't
**Problem:** `.component.html` files use `.html` extension and are mostly valid HTML, but contain Angular-specific syntax (`[attr]`, `(event)`, `*ngIf`) that JSDOM parses incorrectly — `[aria-label]="expr"` becomes a literal attribute named `[aria-label]`, invisible to axe-core. Result: false "missing aria-label" violations on every dynamically-bound accessibility attribute.

**Solution:** Two-pass regex transformer:
- Pass 1: Strip Angular 17+ control flow lines (`@if`, `@for`, `@defer`, etc.) — these are not HTML and no parser can handle them
- Pass 2: Transform Angular binding syntax line-by-line into valid HTML equivalents (`[aria-label]="x"` → `aria-label="dynamic"`)

### Challenge 2 — Angular 17+ control flow blocks (`@if`, `@for`, `@defer`)
**Problem:** Angular 17 introduced a new template syntax using `@` keywords and `{}` blocks instead of `*ngIf`/`*ngFor` directives. No lightweight HTML parser understands this syntax. Inner HTML content inside the blocks still needs to be scanned.

**Solution:** Pass 1 identifies control flow lines by two simple rules:
1. Trimmed line starts with `@` → strip it
2. Trimmed line starts with `}` (standalone or `} @else`) → strip it

The inner HTML between the braces survives because it's on separate lines that don't match either rule.

### Challenge 3 — Inline templates in `.component.ts` files
**Problem:** Some Angular components embed their template directly in the TypeScript file as a backtick string (`template: \`...\``). These lines are TypeScript, not HTML, and the template's line numbers must map back into the `.ts` source file — not be reset to 1.

**Solution:** `angularTsExtractor.js` character-walks the source to find the opening and closing backtick (handling `\`` escapes), then computes `lineOffset = lines before backtick`. The transformer accepts `lineOffset` as a parameter: `sourceLine = lineOffset + contentLineIndex + 1`.

### Challenge 4 — Two bugs found during edge-case testing

**Bug A — `(document:click)` not stripped**  
Global event bindings use a colon in the event name (`document:click`). The original regex character class `[\w.$-]` didn't include `:`, so the pattern wasn't matched and the raw `(document:click)="fn()"` leaked into the output HTML.  
**Fix:** Extended character class to `[\w.$:-]`.

**Bug B — `[ngClass]`, `[ngStyle]`, `[ngSwitch]` becoming spurious attributes**  
These Angular directive bindings fell through to the generic property binding regex `\[([\w][\w-]*)\]` → `ngclass="dynamic"`. While not causing false violations, it polluted the transformed HTML with meaningless attributes.  
**Fix:** Added explicit removal patterns for Angular-specific directive bindings before the generic property binding rule runs.

---

## Alternative Analysis

### Decision: Regex-based transformer vs. `@angular/compiler`

| Factor | `@angular/compiler` | Regex two-pass |
|---|---|---|
| Accuracy | 100% — full Angular AST | ~95% — handles all real-world patterns |
| Dependency weight | ~20–40 MB (requires `@angular/core`) | 0 MB — no new dependencies |
| Angular 17+ support | Yes | Yes (explicit `@` detection) |
| Complexity | High — build-pipeline tool | Low — 200 lines, fully readable |
| Maintenance risk | Tied to Angular version cadence | Tied only to Angular syntax conventions |

**Why regex won:** There is no "right-sized" Angular parser. `@vue/compiler-dom` was used for Vue because it's lightweight (~1 MB), official, and purpose-built for standalone use. The Angular equivalent would drag in the entire Angular platform. Additionally, Angular 17+ control flow blocks (`@if`, `@for`) require preprocessing regardless — even `@angular/compiler` needs special handling for these in certain contexts. For an accessibility scanner that needs "good enough HTML" rather than "semantically perfect Angular AST", regex is the correct engineering trade-off.

### Decision: `component.ts` glob via `SUPPORTED_EXTENSIONS` vs. separate resolver

Rather than adding a parallel discovery path in `fileResolver.js`, we added `'component.ts'` to `SUPPORTED_EXTENSIONS`. The glob pattern `**/*.component.ts` naturally targets only Angular component files — not all TypeScript files — avoiding the overhead of scanning thousands of non-template `.ts` files in a large project.

### Decision: Two fixture files per transformer

A single "sample" fixture doesn't adequately test transformer correctness. The distinction:
- `sample.<ext>` — proves the happy path works end-to-end
- `<framework>-edge-cases.<ext>` — stress-tests the transformer logic: dynamic bindings that should NOT produce violations, nested elements, control flow, and deliberate violations that MUST be caught

This pattern was codified into `CLAUDE.md` as a permanent standing rule.

---

## Developer's Glossary

| Term | Definition |
|---|---|
| **Angular SFC** | Single File Component — Angular splits components across `.component.ts`, `.component.html`, `.component.scss` (unlike Vue which combines them in one `.vue` file) |
| **Property binding** | `[attr]="expr"` — Angular syntax to set an HTML attribute from a TypeScript expression at runtime. Brackets denote one-way data flow from component to template. |
| **Event binding** | `(event)="handler()"` — Angular syntax to attach DOM event listeners. Parentheses denote one-way data flow from template to component. |
| **Two-way binding** | `[(ngModel)]="var"` — "banana in a box" syntax, shorthand for `[ngModel]="var" (ngModelChange)="var=$event"`. Keeps template and component state in sync. |
| **Structural directive** | `*ngIf`, `*ngFor` — directives that add/remove DOM elements. The `*` is syntactic sugar for `<ng-template>`. |
| **`[attr.aria-label]`** | Angular's explicit attribute binding form — sets the HTML attribute (not the DOM property). Important for ARIA attributes which don't always have matching DOM properties. |
| **Angular 17+ control flow** | New built-in template syntax (`@if`, `@for`, `@switch`, `@defer`) that replaces structural directives. Compiled away by Angular — produces no DOM nodes of its own. |
| **`@defer`** | Angular 17+ deferred loading block — lazy-loads a component when a trigger condition is met (idle, viewport, timer). Has `@placeholder`, `@loading`, `@error` sub-blocks. |
| **lineMap** | `Map<htmlLineNumber, sourceLineNumber>` — built by each transformer to map axe-core's HTML-relative violation positions back to original source file line numbers. |
| **ordinalIndex** | `Map<tagName, sourceLineNumber[]>` — records the source line of every occurrence of each tag in document order. Enables O(1) "Nth occurrence" resolution when CSS selectors alone are ambiguous. |
| **HTML_WRAPPER_OFFSET** | The constant `4` — number of lines in the `wrapInDocument()` HTML shell before the body content starts. violationProcessor subtracts this from axe's reported line to get the content-relative line number. |
| **lineOffset** (extractor) | Number of source lines before an extracted template begins. For `.component.ts` inline templates: `lineOffset = lines up to opening backtick`. Used so `sourceLine = lineOffset + contentLineIndex + 1`. |
| **False positive** | A violation reported by axe-core that doesn't actually exist in the rendered app — caused here by Angular binding syntax like `[alt]="expr"` not being recognized as the `alt` attribute. The transformer's primary job is eliminating these. |
| **Two-pass transformer** | Processing strategy where Pass 1 strips/normalizes non-HTML content (Angular control flow) and Pass 2 transforms the remaining HTML syntax. Keeps each pass focused and testable. |
| **`transformerUtils.js`** | Shared module (global/cross-domain) holding utilities identical across all three transformers: `wrapInDocument`, `escapeAttr`, `HTML_TAGS`. Eliminates triple duplication and provides a single source of truth. |

---

## Topics for Further Study

**Angular fundamentals**
- Angular change detection and the component lifecycle — understand *why* `[property]` and `(event)` exist as separate concepts
- Angular 17 control flow (`@if`, `@for`, `@defer`) — official docs: [angular.dev/guide/templates](https://angular.dev/guide/templates/control-flow)
- Content projection (`<ng-content>`) and the slot model — how Angular composes components

**Accessibility (a11y) internals**
- How `axe-core` traverses the DOM and resolves accessibility violations — understanding its selector engine helps explain why `lineMap` + `ordinalIndex` are needed
- ARIA attribute binding patterns — why `aria-label` as a property binding is different from `aria-label` as an attribute, and when each is appropriate

**Static analysis of dynamic code**
- The fundamental challenge of static a11y analysis on dynamic frameworks — what can and cannot be verified without runtime data
- How tools like `eslint-plugin-jsx-a11y` (React) and `eslint-plugin-vuejs-accessibility` approach the same problem with AST-level analysis

**Regex engineering**
- Lookaheads and lookbehinds in regex — how `(?!\/)` prevents the opening tag regex from matching closing tags
- Character class subtleties — why `[\w.$:-]` correctly matches `document:click` but `[\w.$-]` does not (the `-` position in a character class)

**Node.js / ESM patterns**
- ES Module interop: why `_traverse.default ?? _traverse` is needed in `jsxTransformer.js` — CommonJS/ESM boundary issues with Babel packages
- The `createRequire(import.meta.url)` pattern — how ESM files can resolve CommonJS paths like `axe-core`'s bundle location
