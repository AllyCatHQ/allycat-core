# `--changed` Flag — Behavior & Requirements

## What It Does

`--changed` (`-c`) limits the scan to files reported by `git diff --name-only HEAD~1` — the difference between the commit *before* `HEAD` and your current **working tree**. Because the comparison is against the working tree (a single ref, not a `HEAD~1..HEAD` range), it includes the last commit's files **plus** anything currently staged or modified in tracked files.
It is designed for fast feedback where you only want to check what changed, not the entire project — useful for CI / PR pipelines and pre-commit hooks alike. Note that it requires at least two commits to exist.

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

- **Untracked files** — brand-new files that have never been `git add`-ed do not appear in `git diff` output
- **Deleted files** — present in the diff but removed from disk; dropped by the existence check (step 2 above)
- **Before the second commit** — `HEAD~1` does not resolve until at least two commits exist (see [Error Cases](#error-cases))

## Scoping by Directory

```bash
# All changed files in the project
allycat scan --changed

# Only changed files inside ./src
allycat scan --changed ./src
```

The target path is resolved via `path.resolve` so relative paths, `~`, and absolute paths all work.

## Implementation Reference

`resolveChangedFiles()` in [src/commands/scanDispatcher.js](../src/commands/scanDispatcher.js) (line ~87).
