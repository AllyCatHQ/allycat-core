# AllyCat WCAG Audit — Full Verification Report
*Date: 2025-06-05*
*Scope: Verify claims from an internal audit report about WCAG coverage accuracy in AllyCat.*
*Web access (WebFetch/WebSearch) was blocked during this session — WCAG hierarchy facts come from training data. All axe-core and codebase claims are CLI-verified against the actual installed environment.*

---

## Part 1 — WCAG Version Hierarchy

**How versions stack:**

```
WCAG 2.0 (2008)
  └── WCAG 2.1 (2018) — extends 2.0, adds 17 new SC
        └── WCAG 2.2 (2023) — extends 2.1, adds 9 new SC, removes 4.1.1
```

Each version is a **superset** of the previous. A site conforming to 2.2 AA automatically conforms to 2.1 AA (with the SC 4.1.1 Parsing caveat — that SC was removed/obsoleted in 2.2 because browsers now handle it natively).

**How conformance levels stack (within any version):**

```
A (base, required)
  └── AA (includes all A + AA criteria)
        └── AAA (includes all AA + AAA criteria)
```

**The two axes are independent:**
- WCAG **2.2 AA** = newer version + middle strictness
- WCAG **2.1 AAA** = older version + maximum strictness
- These are NOT the same thing. You can be 2.2 AA without being 2.1 AAA, and vice versa.
- **The original report's claim is correct: they are on completely different axes.**

**WCAG 2.2's new Success Criteria (from training data):**

| SC | Name | Level |
|----|------|-------|
| 2.4.11 | Focus Appearance | AA |
| 2.4.12 | Focus Appearance (Enhanced) | AAA |
| 2.5.7 | Dragging Movements | AA |
| 2.5.8 | Target Size (Minimum) | AA |
| 3.2.6 | Consistent Help | A |
| 3.3.7 | Redundant Entry | A |
| 3.3.8 | Accessible Authentication (Minimum) | AA |
| 3.3.9 | Accessible Authentication (No Exception) | AAA |

*The original report listed 9 new criteria. The count above is 8. Exact count not web-verified in this session.*

**AAA automation limit:** Many AAA criteria require human judgment (Sign Language, Extended Audio Description, No Timing, Reading Level). The W3C itself states conforming to all AAA criteria may not be possible for some content types. No automated tool can fully cover AAA.

---

## Part 2 — axe-core v4.11.1 Tag Reality (CLI-Verified)

**Installed version confirmed: 4.11.1**

**All WCAG conformance-level tags:**

| Tag | Exists | Rule count |
|-----|--------|------------|
| `wcag2a` | YES | 61 |
| `wcag2aa` | YES | 3 |
| `wcag2aaa` | YES | 3 |
| `wcag21a` | YES | 1 |
| `wcag21aa` | YES | 3 |
| `wcag22aa` | YES | 1 |
| `wcag2a-obsolete` | YES | 2 |
| `wcag21aaa` | **DOES NOT EXIST** | 0 |
| `wcag22a` | **DOES NOT EXIST** | 0 |
| `wcag22aaa` | **DOES NOT EXIST** | 0 |

**The single `wcag22aa` rule:**
- Rule ID: `target-size`
- SC covered: 2.5.8 (Minimum target size 24×24px)
- Default state: `enabled: false` in rule definition

**The 3 `wcag2aaa` rules:**
- `color-contrast-enhanced` — SC 1.4.6 — `enabled: false`
- `identical-links-same-purpose` — SC 2.4.9 — `enabled: false`
- `meta-refresh-no-exceptions` — SC 2.2.4 + 3.2.5 — `enabled: false`

**Critical axe-core behavior (live-tested):**
When `runOnly: { type: 'tag', values: [...] }` is used, it **overrides** `enabled: false` on individual rules. Disabled rules **DO run** when their tag is in `runOnly`.

```
Test: runOnly = ['wcag2aaa']
  identical-links-same-purpose fired: TRUE
  meta-refresh-no-exceptions fired:   TRUE
  color-contrast-enhanced fired:      FALSE  (explicitly suppressed via rules config)
```

---

## Part 3 — Codebase Cross-Reference (Confirmed)

**`src/utils/axeConfig.js` lines 20–23:**
```javascript
const standardTagMap = {
    [STANDARDS.WCAG_AAA]: ['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa'],
    [STANDARDS.WCAG_AA]:  ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']
};
```

**`src/commands/init.js` lines 89–95:**
```javascript
{ value: STANDARDS.WCAG_AA,  label: '🌍 Global Standard (WCAG 2.1 AA)',  hint: 'Industry Standard' },
{ value: STANDARDS.WCAG_AAA, label: '🏥 Strict Mode (WCAG 2.1 AAA)',      hint: 'Government/Medical' },
```

**`src/constants.js`:**
- `CURRENT_CONFIG_VERSION = 1`
- `STANDARDS`: only `wcag-aa` and `wcag-aaa` — no `wcag-22-aa`

**No `wcag22` reference anywhere in `src/`** — confirmed by grep.

**Rule counts by mode (confirmed):**

| Mode | Tags used | Total rules |
|------|-----------|-------------|
| WCAG_AA (current) | wcag2a, wcag2aa, wcag21a, wcag21aa | **68** |
| WCAG_AAA (current, ghost tag present) | + wcag2aaa + wcag21aaa (ghost) | **71** (+3 from wcag2aaa, +0 from ghost) |
| WCAG 2.2 AA (proposed) | wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa | **69** (+1 over current WCAG_AA) |

---

## Part 4 — Verdict on Each Original Report Claim

| Claim | Verdict | Notes |
|-------|---------|-------|
| `wcag21aaa` is a ghost tag — doesn't exist | **CONFIRMED** | Zero occurrences in axe.js source |
| `wcag22aa` exists | **CONFIRMED** | 1 rule: `target-size` |
| `wcag22a` does not exist | **CONFIRMED** | |
| `wcag22aaa` does not exist | **CONFIRMED** | |
| WCAG 2.2 AA ≠ WCAG 2.1 AAA (different axes) | **CONFIRMED** | |
| Current AAA mode = "WCAG 2.0 AAA + WCAG 2.1 AA" | **PARTIALLY CORRECT** | See note below |
| Label "Strict Mode (WCAG 2.1 AAA)" is misleading | **CONFIRMED** | Exact label + hint confirmed in code |
| Correct 2.2 AA tags: wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa | **CONFIRMED** | |

**Note on "WCAG 2.0 AAA + WCAG 2.1 AA" claim:**
The report's description is nearly correct but has a nuance. The `wcag2aaa` rules DO fire — `runOnly` overrides `enabled:false`. So the AAA mode actually runs:
- All 68 AA rules (same as AA mode)
- Plus 2 additional `wcag2aaa` rules in quickScanner (`identical-links-same-purpose`, `meta-refresh-no-exceptions`)
- `color-contrast-enhanced` is explicitly suppressed in quickScanner (correct — JSDOM cannot compute real contrast)
- `wcag21aaa` contributes nothing (ghost tag)
- **Conclusion:** The label "WCAG 2.1 AAA" is still misleading. There are no WCAG-2.1-specific AAA rules in axe-core. The 3 `wcag2aaa` rules are general (not version-specific), and only 2 of them run in JSDOM mode.

---

## Part 5 — New Findings Not in the Original Report

### Finding A — `enabled:false` rules DO fire via `runOnly`

The original report implied the `wcag2aaa` rules might not run due to `enabled:false`. They do. `runOnly` with tags overrides the default `enabled:false`. The fact that AllyCat's `quickScanner.js` explicitly suppresses `color-contrast-enhanced` via:

```javascript
rules: {
    'color-contrast': { enabled: false },
    'color-contrast-enhanced': { enabled: false }
}
```

...proves this: if `enabled:false` already prevented the rule from running, that explicit suppression would be unnecessary. It's actually the correct defensive pattern.

### Finding B — Adding WCAG 2.2 only adds 1 rule in axe-core v4.11.1

The `wcag22aa` tag covers only **1 rule** (`target-size`). axe-core does not yet have automated rules for most of the other new WCAG 2.2 SC (Focus Appearance, Dragging Movements, Consistent Help, Redundant Entry, Accessible Authentication). If a "WCAG 2.2 AA" option is added, users must be told this: it adds 1 additional automated check, not full 2.2 AA coverage. This is a gap in axe-core, not in AllyCat.

### Finding C — fullScanner does not suppress `color-contrast-enhanced`

`quickScanner.js` correctly disables `color-contrast-enhanced` (JSDOM cannot compute real styles). `fullScanner.js` uses `.withTags(getAxeTags(config))` from `@axe-core/playwright` with no rule override. In a Playwright context (real browser), contrast detection can work — so this is likely intentional and correct. It does mean WCAG_AAA behaves slightly differently between scan modes (full scanner may run one more AAA rule).

---

## Part 6 — Recommended Actions

### Action 1 — Remove ghost tag `wcag21aaa`
**Priority: High**
**File:** `src/utils/axeConfig.js:21`
Drop `'wcag21aaa'` from the WCAG_AAA tag array.
It is silently ignored, contributes 0 rules, and its presence is deceptive to anyone reading the code.

### Action 2 — Relabel the AAA mode
**Priority: High**
**File:** `src/commands/init.js:93`
The label "Strict Mode (WCAG 2.1 AAA)" with hint "Government/Medical" overpromises.
There are no WCAG 2.1-specific AAA rules in axe-core. What you actually get is all AA rules + 2 extra general AAA rules.
Proposed honest label:
```
🏥 Extended Mode — AA + automatable AAA rules
hint: Best effort; full AAA requires a manual audit
```

### Action 3 — Add WCAG 2.2 AA mode
**Priority: High**
**Files affected:** `src/constants.js`, `src/utils/axeConfig.js`, `src/commands/init.js`, `docs/configuration.md`
Tag set: `['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']`
Adds 1 rule (`target-size` / SC 2.5.8) over the current WCAG_AA mode.
Label must be honest about automation gaps:
```
🆕 WCAG 2.2 AA (where automatable) — Industry Frontier
hint: Adds target size check; full 2.2 requires manual audit for other new SC
```
No config version bump required — `selectedStandard` already stores a string; adding a new valid string does not change schema shape.

### Action 4 — Document automation gaps in docs
**Priority: Low**
**File:** `docs/configuration.md`
Add a section explaining:
- What percentage of WCAG criteria are automatable by axe-core
- That WCAG_AAA / Extended Mode covers the automatable subset only
- That WCAG 2.2 AA in axe-core currently means SC 2.5.8 only
- That full compliance at any level requires manual review alongside the tool
