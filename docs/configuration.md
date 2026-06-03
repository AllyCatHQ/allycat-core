# Configuration Reference

This guide covers all configuration options in `allycat.config.json` and how to tune parallel scanning performance.

---

## Config File

Running `allycat init` creates `allycat.config.json` in your project root. You can also edit it manually.

```json
{
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
| `selectedStandard` | `wcag-aa`, `wcag-aaa` | Accessibility ruleset to enforce |
| `rules.rtl` | `true`, `false` | Enable RTL direction checking |
| `rules.level` | `AA`, `AAA` | WCAG conformance level |
| `scan.defaultMode` | `quick`, `full` | Default scan mode when no flag is passed |
| `ai.enabled` | `true`, `false` | Generate HTML report with AI-ready fix prompts after each scan |
| `ai.agent` | `claude`, `cursor`, `chatgpt`, `gemini`, `copilot`, `generic` | AI agent used to generate fix prompt style (set by `allycat init`) |
| `ai.reportBehavior` | `auto-open`, `path-only`, `ask` | How the fix-prompt HTML report is delivered after each scan. `auto-open` = opens in browser automatically, `path-only` = prints relative + absolute path to terminal, `ask` = prompts you each time. Defaults to `path-only` if unset. |
| `performance.concurrency` | integer or `null` | Files scanned in parallel. `null` = auto (computed from RAM + CPU) |

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

### Overriding the default

To set a custom concurrency value, run `allycat init`, enable **advanced options**, and choose a preset or enter a custom value.

If your value exceeds the safe ceiling, AllyCat will warn and ask for confirmation before saving.

If a manually set value exceeds the safe ceiling at scan time, it is clamped automatically with a warning:

```
[allycat] performance.concurrency "40" exceeds safe limit for your system
in quick mode. Clamped to 24.
```
