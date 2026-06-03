# Archived Feature: Israeli Standard IS 5568

**Status:** Removed — RTL promoted to standalone opt-in feature  
**Removed in:** June 2026 (develop branch)  
**Reason:** RTL checking decoupled from any regional standard to make it universally applicable

---

## What This Feature Was

AllyCat previously supported the Israeli Accessibility Standard IS 5568 as a selectable
compliance target alongside WCAG AA and AAA. When selected, the scanner:

- Set the scan header to **"Israeli Standard IS 5568"**
- Automatically included RTL direction checking (no separate `rtl: true` flag needed)
- Reported a dedicated violation with rule ID `israel-rtl` (severity: serious)

---

## The Violation

**Rule ID:** `israel-rtl`  
**Severity:** serious  
**Trigger:** A page with `<html lang="he">` (or any RTL language code) that has no `dir="rtl"` on the `<html>` element

**Message reported to the user:**
> Israeli law requires RTL direction for Hebrew interfaces.

**Expected output block in scan results:**
```
[SERIOUS] israel-rtl
  File:    tests/samples/html/RtlBad.html
  Line:    2
  Element: <html lang="he">
  Fix:     Add dir="rtl" to the <html> element.
```

---

## How It Was Configured

Selecting the Israeli standard in `allycat init` produced:

```json
{
  "selectedStandard": "israel",
  "rules": {
    "rtl": true,
    "level": "AA"
  }
}
```

The `init` wizard offered three choices:
- `wcag-aa` — WCAG 2.1 Level AA (default)
- `wcag-aaa` — WCAG 2.1 Level AAA
- `israel` — Israeli Standard IS 5568 *(removed)*

---

## Key Files That Would Need to Be Restored

| File | What to Add Back |
|---|---|
| `src/constants.js` | `ISRAEL: 'israel'` in `STANDARDS` + entry in `STANDARD_LABELS` |
| `src/commands/init.js` | `israel` option in the standard selection prompt |
| `src/utils/axeConfig.js` | Branch for `selectedStandard === 'israel'` in tag/rule selection |
| `src/engine/violations/rtlValidator.js` | Update violation message to reference IS 5568 when standard is `israel` |
| `src/engine/scanners/rtlRunner.js` | Pass standard context; auto-enable RTL when standard is `israel` |
| `src/commands/helpContent.js` | Add IS 5568 to FAQ and the standards comparison table |
| `docs/configuration.md` | Add `israel` to `selectedStandard` valid values table |

---

## Test Fixtures

These files were built for the Israeli standard and still exist in the repo with updated comments.
Their HTML/JSX structure remains valid for RTL testing under the standalone `rtl: true` flag.

| File | Original Purpose |
|---|---|
| `tests/rtl-true-violations.html` | Hebrew checkout page — no `dir="rtl"` — expects `israel-rtl` violation |
| `tests/rtl-edge-cases.html` | Bilingual page (English primary, Hebrew scoped) — false positive catalogue |
| `tests/samples/html/RtlBad.html` | HTML with `lang="he"` and no `dir="rtl"` |
| `tests/samples/react/jsx/RtlBad.jsx` | JSX component missing `dir="rtl"` on root |
| `tests/samples/react/jsx/RtlGood.jsx` | JSX component with correct `dir="rtl"` |

---

## Known Issues at Time of Removal

### ISSUE-008 — False Positives in Bilingual Pages

The original `checkRtlCompliance` only inspected `<html lang>`. It fired incorrectly on four
edge cases where no global RTL was needed:

| Edge Case | Description | Old Behaviour |
|---|---|---|
| **A — Per-section RTL** | Primary lang is English. Hebrew block has `dir="rtl"` on its own container. `<html>` correctly stays LTR. | Fired (false positive) |
| **B — CSS-only RTL** | Section uses `direction: rtl` (CSS) without a `dir` attribute. Different a11y issue, not an RTL obligation on `<html>`. | Fired (false positive) |
| **C — English-only section** | Mixed-content page; some sections contain zero Hebrew/Arabic characters — no RTL obligation there. | Fired (false positive) |
| **D — Inline `<bdi>`** | Hebrew phrase embedded in English sentence inside `<bdi>` — the correct WHATWG pattern for inline bidi isolation. No global `dir="rtl"` needed. | Fired (false positive) |

A fix for ISSUE-008 was designed but **never merged** before the standard was removed.
The proposed fix would detect RTL language presence at sub-element level instead of only
checking `<html lang>`.

**See `tests/rtl-edge-cases.html`** for the full false-positive reproduction fixture with
comments explaining each case.

---

## Why It Was Removed

1. **Scope creep** — RTL is a universal accessibility concern (Hebrew, Arabic, Persian, Urdu,
   and six other languages), not an Israeli-specific requirement. Coupling it to a regional
   standard limited discoverability and excluded valid use cases.

2. **Naming friction** — The `israel` standard identifier was geographically specific, not
   extensible to other regions, and created awkward UX in the init wizard.

3. **Unresolved ISSUE-008** — False positives on bilingual pages made the feature unreliable
   without the proposed fix.

---

## Revival Guide

To bring IS 5568 back as a named standard:

1. Add `ISRAEL: 'israel'` to `STANDARDS` in `src/constants.js`
2. Add `'israel': 'Israeli Standard IS 5568'` to `STANDARD_LABELS`
3. Restore the `israel` option in the standard prompt inside `src/commands/init.js`
4. In `src/engine/violations/rtlValidator.js`, update the violation message to reference IS 5568 when `selectedStandard === 'israel'`
5. In `src/engine/scanners/rtlRunner.js`, do the same for the Playwright code path
6. Update `src/commands/helpContent.js` FAQ and comparison table
7. Update `docs/configuration.md` to list `israel` as a valid `selectedStandard` value
8. **Address ISSUE-008 first** — restore with the false-positive fix, not the original broken logic. The `tests/rtl-edge-cases.html` fixture documents exactly what must pass.
9. Update test fixture comments in `RtlBad.html`, `RtlBad.jsx`, `RtlGood.jsx`, and `rtl-true-violations.html` to reference `israel-rtl` again
