# `--changed` Flag — Behavior & Requirements

## What It Does

`--changed` (`-c`) limits the scan to files that were modified in the **last git commit** (`HEAD~1..HEAD`).
It is designed for pre-commit hooks and CI pipelines where you only want to check what changed, not the entire project.

## Git Requirement

This flag **requires git**. It runs `git diff --name-only HEAD~1` internally.
If git is unavailable or the repository state is invalid, the scan exits early with a clear error — no files are scanned.

### Error Cases

| Condition | Error message | Fix |
|---|---|---|
| No git repo in the working directory | `Not a git repository — --changed requires git.` | Run `git init` and make at least 2 commits |
| Only one commit exists | `No previous commit to compare against.` | Make a second commit first |
| Unexpected git failure | `git error: <raw message>` | Verify git is installed and in PATH |

## What Gets Included

After `git diff --name-only HEAD~1` runs, the file list is filtered:

1. **Extension filter** — only files with a supported extension are kept (`.html`, `.htm`, `.jsx`, `.tsx`, `.vue`, `.component.html`, `.component.ts`)
2. **Existence check** — deleted files (present in diff but not on disk) are dropped
3. **Scope filter** — if a `<target>` path was passed (e.g. `allycat scan --changed ./src`), only files under that path are kept using a strict path-boundary check (prevents false prefix matches like `src/` matching `src-old/`)

## What Is NOT Included

- **Unstaged edits** — files edited but not committed are not picked up
- **Staged-only changes** — only committed diffs are considered (the `HEAD~1` reference means "since the commit before HEAD")

## Scoping by Directory

```bash
# All changed files in the project
allycat scan --changed

# Only changed files inside ./src
allycat scan --changed ./src
```

The target path is resolved via `path.resolve` so relative paths, `~`, and absolute paths all work.

## Implementation Reference

`resolveChangedFiles()` in [src/commands/scan.js](../src/commands/scan.js) (line ~279).
