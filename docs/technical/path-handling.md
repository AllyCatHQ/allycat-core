# Path Handling — A11yGuard Core
**Last updated:** 2026-03-02

---

## Overview

A11yGuard accepts a target file or directory path as the first argument to `scan`:

```bash
a11y-guard scan <target>
```

All path styles are normalized before resolution so that the tool works correctly regardless of how the user types the path — forward slashes, backslashes, trailing slashes, relative prefixes, or leading slashes.

---

## Normalization Pipeline

User input flows through three stages before a file or directory is opened:

```
CLI input (raw string)
    │
    ▼
expandUserPath()          ← pathUtils.js
    Expands ~/             (tilde → OS home dir)
    Strips bare /          (leading slash on Windows → relative path)
    │
    ▼
path.resolve(cwd, target) ← scan.js (validateAndResolveTarget)
    Converts relative → absolute
    Validates existence on disk
    │
    ▼
normalizeForGlob()        ← fileResolver.js (directory branch only)
    Backslashes → forward slashes
    Trailing slash removed
    Used to build the glob pattern for directory scans
```

---

## Supported Path Formats

### Directory targets

| Input typed | Resolved to (example) | Works? |
|---|---|---|
| `src` | `<cwd>/src` | ✓ |
| `./src` | `<cwd>/src` | ✓ |
| `src/` | `<cwd>/src` | ✓ trailing slash stripped |
| `./src/` | `<cwd>/src` | ✓ |
| `.\src` | `<cwd>/src` | ✓ backslash accepted (Windows) |
| `.\src\` | `<cwd>/src` | ✓ |
| `/src` | `<cwd>/src` | ✓ bare leading slash stripped on Windows |
| `/src/` | `<cwd>/src` | ✓ |
| `C:\Users\me\project\src` | `C:/Users/me/project/src` | ✓ absolute path |
| `~/projects/src` | `C:\Users\me\projects\src` | ✓ tilde expanded to OS home |

### File targets

| Input typed | Resolved to (example) | Works? |
|---|---|---|
| `src/App.jsx` | `<cwd>/src/App.jsx` | ✓ |
| `./src/App.jsx` | `<cwd>/src/App.jsx` | ✓ |
| `.\src\App.jsx` | `<cwd>/src/App.jsx` | ✓ backslash accepted |
| `/src/App.jsx` | `<cwd>/src/App.jsx` | ✓ bare leading slash stripped |
| `C:\Users\me\project\src\App.jsx` | `C:/Users/me/project/src/App.jsx` | ✓ absolute path |
| `~/project/src/App.jsx` | `C:\Users\me\project\src\App.jsx` | ✓ tilde expanded |

### Edge cases

| Input typed | Result | Notes |
|---|---|---|
| `~/nonexistent` | "path not found" error | Tilde expands correctly; path just doesn't exist |
| `//server/share` | UNC path passed as-is | Not stripped — treated as a valid UNC path |
| `C:/absolute/path` | Used as-is | Drive-letter paths are never modified |
| Paths with spaces | `"path with spaces/src"` | Handled by Commander + Node `fs` — no special treatment needed |

---

## What Is NOT Supported

| Input | Why |
|---|---|
| `~\path` (tilde + backslash) | Not expanded — tilde expansion only triggers on `~/`. In practice, shells expand `~` before Node sees it, so this never arrives as-is |
| `$HOME/path` (shell variable) | Shell variables are expanded by the shell before being passed to Node. If they aren't, the literal string `$HOME` is used and will fail |

---

## Implementation Details

### `expandUserPath()` — `src/utils/pathUtils.js`

Called first, before `path.resolve`. Handles two cases `path.resolve` cannot fix:

```js
// Tilde expansion
'~/src'      →  'C:\\Users\\me/src'   (os.homedir() + rest)

// Leading slash on Windows
'/src'       →  'src'                  (stripped → resolved relative to cwd)
'/src/app'   →  'src/app'
```

UNC paths (`//server/share`) and drive-letter paths (`C:/...`) are left untouched.

### `normalizeForGlob()` — `src/utils/pathUtils.js`

Applied only to **directory** targets, just before building the glob pattern:

```js
'.\\src\\'   →  './src'    (backslashes → forward slashes, trailing slash removed)
'./src/'     →  './src'
```

### `validateAndResolveTarget()` — `src/commands/scan.js`

Single entry point for all path validation. Order of operations:

1. `expandUserPath(target)` — normalize tilde and leading slash
2. `path.resolve(cwd, target)` — make absolute
3. `fs.existsSync()` — confirm path exists on disk, error if not
4. Return the (expanded) target string for downstream use

---

## How to Test

```bash
# All of these should find files and scan:
npm run dev -- scan tests/fixtures
npm run dev -- scan tests/fixtures/
npm run dev -- scan ./tests/fixtures
npm run dev -- scan ./tests/fixtures/
npm run dev -- scan .\tests\fixtures
npm run dev -- scan /tests/fixtures

# Single file:
npm run dev -- scan tests/fixtures/sample.component.html
npm run dev -- scan ./tests/fixtures/sample.component.html
npm run dev -- scan .\tests\fixtures\sample.component.html
npm run dev -- scan /tests/fixtures/sample.component.html

# Tilde — only works if the path exists under your OS home dir:
npm run dev -- scan ~/some/real/path

# These must fail with a clear "path not found" error:
npm run dev -- scan /doesnt/exist
npm run dev -- scan ~/doesnt/exist
```
