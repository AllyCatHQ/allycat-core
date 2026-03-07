# Summary UI Design — Terminal Violation Summary

**Component:** `formatSummary()` in `src/utils/violationFormatter.js`
**Used by:** `outputSummaryOnly()`, `outputTerminal()`, `outputJsonFile()` in `src/commands/scanOutputters.js`

---

## Context

The violation summary is printed at the end of every scan — both in regular terminal mode (after the full violation list) and when `--summary` is used alone. It is the "bottom line" a developer reads first in CI output. It needs to be visually distinct from the noise above it.

---

## Original Baseline (replaced, no rank)

Plain text with chalk colors. No visual structure — blended into the violation list above it and was easy to miss.

```
✖ Found 7 violations in 3 files
   4 critical, 2 serious, 1 minor
   (use --full for contrast checking)
```

**Problems that drove the redesign:**
- No visual separation from the violation list above
- Impact counts on one line, comma-separated — slow to scan
- `--full` hint was `chalk.dim`, barely visible
- No structure to guide the eye

---

## Option 1 — Box + Progress Bars ✅ Implemented

Full bordered box with proportional `█` bar charts per impact level.
Bars scale relative to the highest count — the worst impact always gets the full bar width.

```
  ╭──────────────── Scan Summary ────────────────╮
  │                                              │
  │  Total: 7 violations in 3 files              │
  │                                              │
  │  ● CRITICAL   4   ██████████████████        │
  │  ● SERIOUS    2   █████████                 │
  │  ● MODERATE   0   —                         │
  │  ● MINOR      1   █████                     │
  │                                              │
  │  ⚠  Use --full for contrast checking        │
  │                                              │
  ╰──────────────────────────────────────────────╯
```

**Implementation details (from `formatSummary()`):**
- Inner box width: `INNER = 48` chars
- Max bar length: `MAX_BAR = 18` blocks
- Bar length per impact: `Math.round((count / maxCount) * MAX_BAR)`
- Zero-count rows: bar replaced by `—`, entire row `chalk.dim`

**Colors:**
- Box borders (`╭ ─ │ ╰`): `chalk.dim` gray
- `Total: N violations in N files`: `chalk.red.bold`
- `● CRITICAL` / `● SERIOUS` + bar: `chalk.red`
- `● MODERATE` + bar: `chalk.yellow`
- `● MINOR` + bar: `chalk.blue`
- Zero rows (label + count + `—`): `chalk.dim` gray
- `⚠  Use --full...` tip: `chalk.dim`, only shown in quick scan mode

**Why chosen (user preference over recommended Option 2):**
- Richer visual output — the bar chart makes the distribution immediately obvious
- Each impact level is on its own line — easier to parse than a 2×2 grid
- The proportional bars expose skew at a glance (e.g. 12 critical vs 1 minor is visually dramatic)

---

## Option 2 — Horizontal Dividers ★ Rank 1 (original recommendation)

Double-line dividers (`═`) above and below the title. Impact grid is 2×2 — fast to read.
No full box, so terminal width doesn't matter — no wrapping risk.

```
  ════════════════════════════════════════════════
   ✖  Scan Summary · 7 violations in 3 files
  ════════════════════════════════════════════════

   CRITICAL    4          SERIOUS     2
   MODERATE    0          MINOR       1

  ════════════════════════════════════════════════
   ⚠  Use --full for contrast checking
```

**Colors:**
- `═` divider line: `chalk.dim` gray
- `✖ Scan Summary` title: `chalk.red.bold`
- `· N violations in N files`: `chalk.dim`
- `CRITICAL` / `SERIOUS`: `chalk.red` (dimmed when count is 0)
- `MODERATE`: `chalk.yellow` (dimmed when 0)
- `MINOR`: `chalk.blue` (dimmed when 0)
- `⚠` tip: `chalk.dim`

**Why ranked #1 (not chosen):**
- No box = no terminal-width assumptions; CI panels are often narrow
- Double `═` lines give strong visual separation without fragility
- 2×2 grid is faster to read than a vertical list
- Zero-count cells are auto-dimmed — eyes land only on active issues

---

## Option 3 — Box + Top Offenders ★ Rank 2

Full box with impact grid AND a ranked file list. Most actionable — tells you where to fix first without scrolling back up.

```
  ╭─ Scan Results ──────────────────────────────╮
  │  7 violations · 3 files affected            │
  ├─────────────────────────────────────────────┤
  │  Critical   4        Serious     2          │
  │  Moderate   0        Minor       1          │
  ├─────────────────────────────────────────────┤
  │  Top offenders:                             │
  │    src/App.jsx            3 issues          │
  │    src/Header.tsx         2 issues          │
  │    components/Nav.jsx     2 issues          │
  ╰─────────────────────────────────────────────╯
```

**Colors:**
- Box borders: `chalk.dim` gray
- `7 violations`: `chalk.red.bold`
- `3 files affected`: `chalk.dim`
- `Critical` / `Serious` counts: `chalk.red`
- `Moderate` count: `chalk.yellow`
- `Minor` count: `chalk.blue`
- File paths: `chalk.cyan`
- Issue counts: `chalk.dim`

**Why ranked #2:**
- Top offenders add real value on large codebases (10+ files)
- Box structure risks wrapping at narrow terminal widths
- File breakdown is redundant on small scans (1–3 files)

**Upgrade path:** If the project grows to scanning 20+ files regularly, revisit this option — the file ranking would become the killer feature.

---

## Decision Log

| Date       | Decision                                       | Reason                                              |
|------------|------------------------------------------------|-----------------------------------------------------|
| 2026-03-03 | Replaced baseline plain text                   | No visual structure, failed to stand out in output  |
| 2026-03-03 | Initially recommended Option 2 (dividers)      | CI-safe, no width assumption, fastest to scan       |
| 2026-03-03 | Implemented Option 1 (box + bars) instead      | User preference for richer, more visual output      |
