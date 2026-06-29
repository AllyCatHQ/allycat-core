# Configuration Reference

This guide covers all configuration options in `allycat.config.json` and how to tune parallel scanning performance.

---

## Config File

Running `allycat init` creates `allycat.config.json` in your project root. You can also edit it manually.

```json
{
  "configVersion": 1,
  "selectedStandard": "wcag-aa",
  "rules": {
    "rtl": false,
    "level": "AA"
  },
  "scan": {
    "defaultMode": "quick"
  },
  "ai": {
    "enabled": true,
    "agent": "claude",
    "reportBehavior": "path-only"
  },
  "performance": {
    "concurrency": null
  }
}
```

---

## Field Reference

| Option | Values | Description |
|---|---|---|
| `configVersion` | integer | Schema version written by `allycat init`. Read by the tool to detect outdated configs and auto-migrate. Never edit this manually. |
| `selectedStandard` | `wcag-aa`, `wcag-22-aa`, `wcag-aaa` | Accessibility ruleset to enforce (`wcag-aa` = WCAG 2.1 AA, `wcag-22-aa` = WCAG 2.2 AA automated rules, `wcag-aaa` = AAA automated rules) |
| `rules.rtl` | `true`, `false` | Enable RTL direction checking |
| `rules.level` | `AA`, `AAA` | WCAG conformance level |
| `scan.defaultMode` | `quick`, `full` | Default scan mode when no flag is passed |
| `ai.enabled` | `true`, `false` | Generate HTML report with AI-ready fix prompts after each scan |
| `ai.agent` | `claude`, `cursor`, `chatgpt`, `gemini`, `copilot`, `generic` | AI agent used to generate fix prompt style (set by `allycat init`) |
| `ai.reportBehavior` | `auto-open`, `path-only`, `ask`, `never` | How the fix-prompt HTML report is delivered after each scan. `auto-open` = opens in browser automatically, `path-only` = prints relative + absolute path to terminal, `ask` = prompts you each time, `never` = no file written (use `allycat report` to generate on demand). Defaults to `path-only` if unset. |
| `performance.concurrency` | integer or `null` | Files scanned in parallel. `null` = auto (computed from RAM + CPU) |

### Invalid values

Every field above is validated at load time against its allowed values. If a hand-edited
config contains an invalid value (e.g. `"selectedStandard": "wcag-aaaaa"`), AllyCat prints
a warning naming the field, the bad value, and the valid options, then continues the scan
with the built-in default for that field. Your config file is never rewritten — fix the
value or run `allycat init` to regenerate it.

```
[allycat] selectedStandard "wcag-aaaaa" is not a valid value — falling back to "wcag-aa".
  Valid values: wcag-aa, wcag-aaa, wcag-22-aa
```

If a key name itself is unknown or misspelled, AllyCat warns and suggests the correct name
when the typo is close:

```
⚠  allycat.config.json: unknown key "selectedStandart" — did you mean "selectedStandard"?
⚠  allycat.config.json: unknown key "foo" (ignored)
```

All warnings are written to stderr, so they show up in CI logs and never corrupt
`--output json` results on stdout. The scan banner and reports always display the standard
that actually ran.

---

## Accessibility Standards & Automation Limits

The `selectedStandard` field controls which axe-core rules run. The three options differ in breadth:

| Standard value | Wizard label | axe-core tags | Rules run | Adds over previous |
|---|---|---|---|---|
| `wcag-aa` | Global Standard (WCAG 2.1 AA) | wcag2a, wcag2aa, wcag21a, wcag21aa | 68 | — (baseline) |
| `wcag-22-aa` | WCAG 2.2 AA | + wcag22aa | 69 | +1 rule (SC 2.5.8 Target Size) |
| `wcag-aaa` | Strict Mode (WCAG AAA) | + wcag2aaa | 71 | +2 rules (SC 2.4.9, SC 2.2.4/3.2.5) |

### What "automated rules" means

axe-core can only automate a subset of WCAG criteria. Many success criteria require human judgment and cannot be tested programmatically. AllyCat catches what can be caught automatically — it does not and cannot replace a manual audit.

**Examples of criteria that cannot be automated:**

| WCAG level | Criterion | Why it needs human review |
|---|---|---|
| AAA | 1.2.6 Sign Language | Requires a human to evaluate sign language interpretation |
| AAA | 3.1.5 Reading Level | Requires a human to assess text complexity |
| 2.2 AA | 2.4.11 Focus Appearance | Visual judgment required |
| 2.2 AA | 2.5.7 Dragging Movements | Interaction testing required |
| 2.2 AA | 3.2.6 Consistent Help | Page layout review required |
| 2.2 AA | 3.3.7 Redundant Entry | Form flow review required |
| 2.2 AA | 3.3.8 Accessible Authentication | Authentication flow review required |

### WCAG 2.2 AA honest coverage

`wcag-22-aa` adds exactly **1 automated rule** over `wcag-aa`: `target-size` (SC 2.5.8 — minimum 24×24 px for interactive elements). The other new WCAG 2.2 success criteria are not yet automatable by axe-core v4.11.1. As axe-core adds more 2.2 rules in future versions, AllyCat picks them up automatically — no config change needed.

### Recommended workflow

Use AllyCat in CI to catch all automatable violations before deployment. Pair with a manual audit checklist for the criteria that require human review — especially if targeting AAA or full WCAG 2.2 compliance for regulated industries.

---

## Config Versioning

`allycat.config.json` carries a `configVersion` integer. On every run, the tool compares this against its own `CURRENT_CONFIG_VERSION` and handles three cases:

| Situation | What happens |
|---|---|
| Config has no `configVersion` (pre-v1) | Auto-stamped silently, one log line printed |
| Config version is behind the tool | Auto-migrated and saved. User is told to run `allycat init` to review |
| Config version is ahead of the tool | Warning printed, scan continues (update the tool) |
| Config is valid JSON and version matches | Loads normally, zero overhead |
| Config is corrupt / invalid JSON / not a JSON object | Error message printed with file path, falls back to defaults — the file is left untouched |
| Config is a valid object but missing keys (hand-edited) | Missing keys are filled from built-in defaults at load time; user-set values are kept |
| Config has an invalid value (e.g. unknown `selectedStandard`) | Warning printed with the valid options; built-in default used for that field; the file is left untouched |
| Config has an unknown or misspelled key name | Warning printed with a "did you mean" suggestion when the typo is close; the key is ignored and the scan continues |
| Config file is not writable (read-only / CI sandbox) | Migration applies in-memory with a warning; retried on next run |

Users do not need to do anything manually — migration is automatic and non-destructive.

### For developers: when to bump `configVersion`

> **This is a release-time responsibility. See the checklist in [`docs/BEFORE-EVERY-RELEASE.md`](../BEFORE-EVERY-RELEASE.md) — Section 6.**

When you change the shape of `allycat.config.json` (add a required key, rename a key, remove a key, change a value format):

1. Bump `CURRENT_CONFIG_VERSION` in `src/constants.js`
2. Add a migration block in `migrateConfig()` in `src/utils/configLoader.js`
3. Update `DEFAULT_CONFIG` in `configLoader.js` if the new key needs a default for fresh installs
4. Update the Field Reference table and JSON example in this file

`configVersion` does **not** move on bug fixes, performance changes, or new CLI flags — only when the config file's schema changes.

---

## Parallel Scanning & Performance

AllyCat auto-computes the parallel scan limit from your machine's RAM and CPU. The resolved limit is shown on every run:

```
│ Parallel:  Auto → 24 files
```

### Formula

- **Quick mode:** `min(60% RAM ÷ 200 MB, CPU cores × 4)`
- **Full mode:** `min(60% RAM ÷ 500 MB, CPU cores × 4, 8)` — capped at 8 due to Playwright CPU overhead

### Ceilings by machine

| RAM | Cores | Quick limit | Full limit |
|-----|-------|-------------|------------|
| 4 GB | 4 | 12 | 4 |
| 8 GB | 8 | 24 | 8 |
| 16 GB | 8 | 32 | 8 |
| 32 GB | 16 | 64 | 8 |

### Scan timeouts and slow-file reporting

Each file has a **30-second timeout**. If a file exceeds this limit it is automatically skipped with a warning — one stuck file cannot hang the entire scan.

After every scan, files that took **longer than 5 seconds** are listed in a post-scan summary so you can spot bottlenecks and `--exclude` them if needed. Timed-out files are reported separately and do not appear in the slow-file list.

The slow-file summary appears in all modes, including `--ci`, so bottlenecks are visible in CI logs.

### Overriding the default

To set a custom concurrency value, run `allycat init`, enable **advanced options**, and choose a preset or enter a custom value.

If your value exceeds the safe ceiling, AllyCat will warn and ask for confirmation before saving.

If a manually set value exceeds the safe ceiling at scan time, it is clamped automatically with a warning:

```
[allycat] performance.concurrency "40" exceeds safe limit for your system
in quick mode. Clamped to 24.
```

---

## Excluding Files

### `.allycatignore`

Create a `.allycatignore` file in your project root to permanently exclude paths from every scan. One glob pattern per line. Lines starting with `#` are comments.

```
# .allycatignore

src/generated/**
public/vendor/**
**/*.generated.html
```

The file is loaded automatically on every scan — no flag required. Commit it to share exclusions across your team.

`.allycatignore` always wins: even if a path is explicitly passed as a scan target, a matching pattern blocks it.

To bypass `.allycatignore` entirely for a single run without editing the file, use `--no-ignore`:

```
allycat scan --no-ignore
```

#### VS Code syntax highlighting

VS Code does not recognise `.allycatignore` by default and may display it with JavaScript syntax highlighting, making comment lines and path patterns look misleading. Add this to your project's `.vscode/settings.json` to render it the same way as `.gitignore`:

```json
{
  "files.associations": {
    ".allycatignore": "ignore"
  }
}
```

### `--exclude`

Use `--exclude` for per-run exclusions that you do not want to commit. Both sources apply simultaneously when present.

```
allycat scan --exclude dist/vendor.html
```
