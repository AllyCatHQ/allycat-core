# Baseline Matching — Design & Behaviour

## What It Does

`--save-baseline` snapshots every current violation into `allycat-baseline.json`.
`--fail-on-new` loads that snapshot on the next scan and exits with code 4 if any
violation is found that was not present in the snapshot.

This allows teams to adopt a CI gate immediately — pre-existing violations are
suppressed, only newly introduced violations block the pipeline.

---

## The Core Problem: How Do You Identify a Violation Across Edits?

The naive approaches all fail in practice:

### Line numbers — too fragile

Storing the line number of each violation breaks the moment any code is added or
removed above it. Insert a 20-line utility function at the top of a file and every
violation in that file shifts by 20. A fuzzy tolerance (±3, ±10) helps with minor
edits but fails on real refactors and creates a tuning problem with no correct answer.

### CSS selector alone — substitution loophole

axe-core returns a unique CSS path per element. If you store only the selector, you
can close the gap between location and identity — but you miss a critical case:

You have 10 identical broken buttons. Developer fixes one but adds a new broken button
elsewhere in the same file. The selector changed (new DOM position) but the total count
is still 10. A selector-only or fingerprint-only counter sees "10 baseline, 10 current"
and reports zero new violations — silently swallowing the regression.

### HTML fingerprint alone — same loophole

Hashing `violation.html` (the actual element markup) solves the line-shift problem
completely — the hash is stable regardless of where the element lives in the file.
But with identical elements, one hash maps to multiple violations. Count-based
consumption fails the same substitution scenario described above.

---

## The Solution: Composite Key

Every baseline entry is identified by **four fields together**:

```
file  +  rule  +  fingerprint  +  selector
```

| Field | What it captures | Stability |
|---|---|---|
| `file` | Which source file | Stable unless file is renamed |
| `rule` | Which axe-core rule (e.g. `image-alt`) | Always stable |
| `fingerprint` | SHA-256 of `violation.html.trim()` | Stable across line shifts; changes only when the element markup changes |
| `selector` | axe-core CSS path (e.g. `main > div:nth-child(2) > button`) | Unique per element instance; changes when DOM structure changes |

A violation matches a baseline entry only when **all four match exactly**.
No fuzzy logic. No line numbers anywhere in the matching pipeline.

---

## Why Each Field Is Necessary

### `fingerprint` handles line shifts

`violation.html` is the actual HTML of the broken element, produced by axe-core from
the live DOM. It has no connection to line numbers. Adding or removing any number of
lines elsewhere in the file does not affect it. The hash is therefore stable across
every edit that does not touch the element itself.

### `selector` closes the substitution loophole

axe-core assigns a unique CSS path to each element instance. Even when 10 buttons have
identical `violation.html`, each gets a different selector (`nth-child(1)` through
`nth-child(10)`). Storing the selector as part of the identity means each baseline entry
corresponds to exactly one element instance — not a count, a fingerprint registry.

When a developer fixes button 1 and adds a new broken button at a new DOM position:
- Button 1's entry is not matched (it no longer appears in the scan) → stale, ignored
- New button has a new selector → no composite match in baseline → **NEW** ✅

### "Touch it, you own it"

If a developer edits the broken element — changes a class, rewrites inner text, adds
an attribute — `violation.html` changes. The hash no longer matches the baseline entry.
The violation is flagged as **NEW**.

This is intentional behaviour, not a false positive. The developer had eyes on the
element and chose not to fix the a11y issue. Resurfacing it at that moment is the
correct and valuable action.

---

## Matching Algorithm

```
classifyViolations(currentViolations, baseline):

  available = copy of baseline.violations     // entries are consumed as they match

  for each violation in currentViolations:
    fp  = sha256(violation.html.trim())
    key = { file, rule, fingerprint: fp, selector: violation.selector }

    match = find first entry in available where all four key fields are equal

    if match found:
      remove match from available             // consumed — cannot match a second violation
      label violation BASELINE
    else:
      label violation NEW

  stale = entries remaining in available      // violations fixed since last --save-baseline
  return { newViolations, baselineViolations, staleCount: stale.length }
```

**Consumption is critical.** Without it, one baseline entry could match multiple
identical violations — re-introducing the substitution loophole at the algorithm level.

**Stale entries are not errors.** An entry that finds no match in the current scan
means the violation was fixed. It is silently ignored and will be removed the next
time `--save-baseline` is run.

---

## Baseline File Format

```json
{
  "createdAt": "2026-03-17T10:00:00.000Z",
  "standard": "wcag-aa",
  "scanMode": "quick",
  "violations": [
    {
      "file": "src/components/Header.jsx",
      "rule": "image-alt",
      "fingerprint": "a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
      "selector": "body > header > img:nth-child(2)",
      "element": "<img src=\"hero.jpg\" class=\"hero-banner\">"
    }
  ]
}
```

| Field | Used for matching | Purpose |
|---|---|---|
| `fingerprint` | ✅ Yes | Core identity — survives line shifts |
| `selector` | ✅ Yes | Instance address — closes substitution loophole |
| `element` | ❌ No | Human-readable copy of the HTML for manual inspection |
| `file`, `rule` | ✅ Yes | Scope filters |

---

## Known Tradeoff: DOM Structural Changes

axe-core selectors use positional notation. If a sibling element is added or removed,
the position of an existing broken element shifts — `nth-child(2)` becomes
`nth-child(3)` — and the selector changes even though the broken element was not
touched.

Under strict composite matching, this produces a false positive: the unchanged
violation has a new selector, finds no match, and is flagged as NEW.

**This tradeoff is explicitly accepted** for three reasons:

1. DOM restructuring is less common than line-only edits (adding a function,
   inserting a comment). The fingerprint approach already handles the more common case.
2. The substitution loophole (the alternative) is a fundamental integrity failure.
   A tool that silently misses real regressions is worse than one that occasionally
   over-reports.
3. When it occurs, `--save-baseline` resolves it in one command with no data loss.

---

## Exit Codes

| Condition | Exit code |
|---|---|
| `--save-baseline` (always) | 0 |
| `--fail-on-new` — no new violations | 0 |
| `--fail-on-new` — at least one NEW violation | **4** |
| `--fail-on-new` — no baseline file found | 0 + warning to stderr |

Exit 4 is distinct from the existing severity gates so CI pipelines can distinguish
which condition triggered the failure:

```
0 — clean / threshold not met
1 — --fail-on-critical triggered
2 — --fail-on-serious triggered
3 — --fail-on-any triggered
4 — --fail-on-new triggered (new regression vs baseline)
```

---

## Implementation Location

All baseline logic lives in `src/utils/baselineManager.js` — a single focused module
with three public functions:

| Function | Responsibility |
|---|---|
| `saveBaseline(violations, config, scanMode)` | Write `allycat-baseline.json` to cwd |
| `loadBaseline()` | Read and parse `allycat-baseline.json`; return null if not found |
| `classifyViolations(violations, baseline)` | Return `{ newViolations, baselineViolations, staleCount }` |

`scanResultHandler.js` owns the orchestration: it calls these functions, passes
the classification to `outputters/index.js` for rendering, and enforces the exit code.
No scanner changes. No violation pipeline changes.

---

## Workflow Summary

```
Day 1
  allycat scan --save-baseline
  → allycat-baseline.json created with all current violations
  → commit to repository

Every CI run
  allycat scan --fail-on-new
  → scan runs normally
  → each violation classified: NEW or BASELINE
  → exit 4 if any NEW found, exit 0 otherwise

After fixing a batch of violations
  allycat scan --save-baseline
  → baseline updated to reflect current (smaller) state
  → stale entries removed automatically
  → commit updated baseline
```
