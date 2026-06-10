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

## The Solution: Two-Tier Composite Key

Every baseline entry stores **four fields**:

```
file  +  rule  +  fingerprint  +  selector
```

| Field | What it captures | Stability |
|---|---|---|
| `file` | Which source file | Stable unless file is renamed |
| `rule` | Which axe-core rule (e.g. `image-alt`) | Always stable |
| `fingerprint` | SHA-256 of `violation.html.trim()` | Stable across line shifts; changes only when the element markup changes |
| `selector` | Stable canonical DOM path (e.g. `body > button:nth-child(2)`) | Unique per element instance; always full positional path — see below |

Matching runs in two tiers:

- **Tier 1** — all four fields must match exactly.
- **Tier 2 (fallback)** — `file + rule + fingerprint` only, applied **only when that
  fingerprint appears exactly once in the baseline and exactly once in the current
  scan** for the same (file, rule). A unique fingerprint is unambiguous identity, so
  position is irrelevant — this is what makes the matching immune to insertions that
  shift every `:nth-child()` below them (see "Insert Before" below).

When two or more elements share an identical fingerprint, tier 2 is disabled for that
group and the strict four-field match applies — which is exactly what keeps the
substitution loophole closed.

No fuzzy logic. No line numbers anywhere in the matching pipeline.

---

## Why Each Field Is Necessary

### `fingerprint` handles line shifts

`violation.html` is the actual HTML of the broken element, produced by axe-core from
the live DOM. It has no connection to line numbers. Adding or removing any number of
lines elsewhere in the file does not affect it. The hash is therefore stable across
every edit that does not touch the element itself.

### `selector` closes the substitution loophole — for identical elements

Instead of storing axe-core's raw CSS selector, AllyCat stores a **stable canonical selector**
computed by walking the live DOM from the element up to `<body>`, always producing a full
positional path with `tag:nth-child(n)` for every node.

**Why not axe's raw selector?** axe-core generates the *shortest unique* selector for each
element. A single `<button>` gets selector `button`; two identical buttons get
`body > button:nth-child(2)` and `body > button:nth-child(3)`. When a second button is added,
axe changes the first button's selector from `button` to `body > button:nth-child(2)` — even
though the element was never touched — breaking composite-key matching.

The stable selector is always in the same full positional format, so it is unaffected by
whether there is one or many instances of an element.

The selector's job is to **disambiguate identical fingerprints**. When 10 buttons have
identical `violation.html`, each gets a different stable selector (`button:nth-child(n)`
relative to its parent), so each baseline entry corresponds to exactly one element
instance — not a count, a fingerprint registry.

When a developer fixes one of 10 identical broken buttons and adds a new broken button at
a new DOM position:
- The group has multiple identical fingerprints → tier 2 is disabled → strict matching
- The 9 untouched buttons match their exact selectors → **BASELINE**
- The fixed button's entry is not matched → stale, ignored
- New button has a new stable selector → no composite match in baseline → **NEW** ✅

For elements whose fingerprint is unique in the file, the selector is *not* required to
match (tier 2) — there it carries no identity information, only position, and position is
exactly what insertions destabilize.

### "Touch it, you own it"

If a developer edits the broken element — changes a class, rewrites inner text, adds
an attribute — `violation.html` changes. The hash no longer matches the baseline entry.
The violation is flagged as **NEW**.

This is intentional behaviour, not a false positive. The developer had eyes on the
element and chose not to fix the a11y issue. Resurfacing it at that moment is the
correct and valuable action.

### Document-level rules match by (file, rule) alone

Six rules fire at most once per page and target the document itself, not an element:
`html-has-lang`, `document-title`, `landmark-one-main`, `page-has-heading-one`,
`meta-viewport`, `bypass` (the `DOCUMENT_LEVEL_RULES` set in `src/constants.js`).

For these, axe's `violation.html` is the `<html>` element — so *any* edit anywhere in
the page changes the fingerprint and would falsely re-flag a known violation. Since the
rule can only fire once per file, `(file, rule)` is already a complete identity;
fingerprint and selector are stored for human inspection but ignored during matching.

This is backward compatible: baseline files saved by older versions match these rules
correctly without a re-save, because their stored fingerprint/selector are simply not
consulted.

---

## Rename Detection (pre-pass)

Before the two-tier matching runs, AllyCat tries to account for files that were
renamed or moved since the baseline was saved.

If `baseline.gitCommit` is present, AllyCat runs `git diff --find-renames` between
that commit and the **working tree**. Any renamed/moved files found are remapped in
memory — the baseline's `file` paths are rewritten to their new locations before
matching, so a file move alone no longer causes its existing violations to appear
as `NEW`.

Because the diff targets the working tree (not `HEAD`), an uncommitted `git mv` is
detected too, and a chain of renames (`A → B → C` across several commits) collapses
to its net result (`A → C`).

If renames affecting baseline entries are detected, a warning is printed suggesting
you re-run `--save-baseline` to persist the updated paths into the committed
baseline file.

All path comparisons are separator-normalized (backslashes → forward slashes), so
baselines travel safely between Windows and Unix machines, and `--save-baseline`
always writes forward-slash paths regardless of OS.

This pre-pass is best-effort and silently does nothing — falling through to the
unmodified two-tier matching — when:
- `gitCommit` is absent (older baseline file) or not a valid commit hash
- git is unavailable in the current environment
- the repository is a shallow clone that doesn't have the baseline commit
- the rename was a plain filesystem move that was never staged or committed —
  git can't pair an untracked file (`git mv` or `git add` makes it visible)
- the scan target was given as an absolute path — scan paths are then absolute
  while git's rename output is cwd-relative, so no remap can apply

A structurally invalid baseline file (not JSON, not an object, or `violations`
not an array) is treated the same as a missing one: a warning is printed and
the whole baseline check — both layers — is skipped. `loadBaseline()` is the
single validation point, so downstream code can trust the shape it receives.

### CI: shallow clones disable rename detection

Most CI providers clone shallowly by default, which usually leaves the baseline
commit out of the local history — rename detection then degrades silently (the
scan still works; renamed files just aren't remapped). To get rename protection
in CI, fetch enough history:

```yaml
# GitHub Actions
- uses: actions/checkout@v4
  with:
    fetch-depth: 0   # full history (default is 1 — shallow)
```

```yaml
# GitLab CI
variables:
  GIT_DEPTH: "0"     # full history (default is shallow)
```

---

## Matching Algorithm

```
classifyViolations(currentViolations, baseline):

  available = copy of baseline.violations     // entries are consumed as they match

  // Group sizes are computed over the FULL sets (pre-consumption):
  // uniqueness means "this markup exists exactly once on each side"
  baselineCounts = count entries  by (file, rule, fingerprint), skipping document-level rules
  currentCounts  = count current  by (file, rule, fingerprint), skipping document-level rules

  // Step 0 + Tier 1
  for each violation in currentViolations:

    if violation.rule is document-level:
      match available entry on (file, rule) only
      consumed → BASELINE, else → NEW
      continue

    fp  = sha256(violation.html.trim())
    match available entry on (file, rule, fingerprint, selector)   // exact, tier 1
    consumed → BASELINE, else → pending

  // Tier 2 — unique-fingerprint fallback (position-independent)
  for each violation in pending:
    key = (file, rule, fingerprint)
    if baselineCounts[key] == 1 and currentCounts[key] == 1:
      match available entry on (file, rule, fingerprint)           // selector ignored
      consumed → BASELINE, else → NEW
    else:
      NEW                                     // ambiguous group → strict matching only

  stale = entries remaining in available      // violations fixed since last --save-baseline
  return { newViolations, baselineViolations, staleCount: stale.length }
```

**Consumption is critical.** Without it, one baseline entry could match multiple
identical violations — re-introducing the substitution loophole at the algorithm level.

**Tier 2 only fires for unambiguous identities.** A fingerprint that exists exactly once
on both sides can only be the same element (or a byte-identical replacement — see
"Accepted Trade-offs" below). For groups of identical elements, position is the only
distinguishing signal, so the exact match is kept.

**Stale entries are not errors.** An entry that finds no match in the current scan
means the violation was fixed. It is silently ignored and will be removed the next
time `--save-baseline` is run.

---

## Baseline File Format

```json
{
  "createdAt": "2026-03-17T10:00:00.000Z",
  "gitCommit": "a3f9c1d8e2b4567890abcdef1234567890abcde",
  "standard": "wcag-aa",
  "scanMode": "quick",
  "violations": [
    {
      "file": "src/components/Header.jsx",
      "rule": "image-alt",
      "fingerprint": "a3f2b1c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2",
      "selector": "body > header:nth-child(1) > img:nth-child(2)",
      "element": "<img src=\"hero.jpg\" class=\"hero-banner\">"
    }
  ]
}
```

| Field | Used for matching | Purpose |
|---|---|---|
| `createdAt` | ❌ No | Timestamp of the `--save-baseline` run |
| `gitCommit` | ❌ No | `HEAD` commit hash at the time `--save-baseline` ran; powers the rename-detection layer (see "Rename Detection" above). `null` if git was unavailable |
| `fingerprint` | ✅ Yes | Core identity — survives line shifts. Ignored for document-level rules |
| `selector` | ✅ Tier 1 only | Disambiguates identical fingerprints — closes the substitution loophole. Ignored in tier 2 and for document-level rules |
| `element` | ❌ No | Human-readable copy of the HTML for manual inspection |
| `file`, `rule` | ✅ Yes | Scope filters — the complete identity for document-level rules |

**Backward compatible:** baseline files saved before `gitCommit` was introduced simply
don't have the field. It is treated as absent/`null`, the rename-detection pre-pass is
skipped, and the two-tier matching runs exactly as before.

---

## Insert Before: Solved for Unique Elements

The stable selector uses `tag:nth-child(n)`, which reflects the element's position
among its parent's children. Inserting a new element **before** an existing violation
shifts the `:nth-child()` value of *every* sibling below it — under pure four-field
matching this cascaded: one insertion mid-page false-flagged every violation below the
insertion point as NEW.

Tier 2 fixes this for the common case. An element whose fingerprint is unique within
its (file, rule) re-matches by fingerprint alone, regardless of where it moved.
Inserting, removing, or reordering elements no longer disturbs unique violations.

## Accepted Trade-offs

Two residual cases are accepted by design — both are consequences of the fact that
byte-identical elements are indistinguishable without position, and position is
unstable under insertion. You cannot have both properties at once; AllyCat keeps the
strict behaviour exactly where ambiguity exists.

1. **Unique-element substitution is suppressed.** If the *only* broken `<input>` in a
   file is fixed and a **byte-identical** broken one is added elsewhere in the same
   file, tier 2 matches the new one to the old entry. This is rare, and the missed
   markup is identical to one the team had already accepted into the baseline.

2. **Identical-fingerprint groups still shift-flag.** When 2+ elements share an
   identical fingerprint, tier 2 is disabled; inserting an element before such a group
   still false-flags its members. This keeps the substitution loophole closed where it
   actually exists. Re-running `--save-baseline` resolves it in one command.

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
