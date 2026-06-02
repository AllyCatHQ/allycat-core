# Release Workflow — How to Publish a New Version

> Internal reference. Covers: what `npm version` does, when to use each variant, and the full publish checklist.

---

## The Two Commands

### `npm version <type>`

Updates the version number in `package.json`, creates a git commit, and creates a git tag — all in one command.

Three variants:

| Command | When to use | Example |
|---|---|---|
| `npm version patch` | Bug fix, no new features | `1.0.0 → 1.0.1` |
| `npm version minor` | New feature, backwards-compatible | `1.0.0 → 1.1.0` |
| `npm version major` | Breaking change (old users must adapt) | `1.0.0 → 2.0.0` |

**What it does under the hood:**
1. Edits `"version"` in `package.json`
2. Runs `git add package.json`
3. Creates a git commit: `1.0.1`
4. Creates a git tag: `v1.0.1`

Because `src/index.js` reads `version` from `package.json` at runtime (ISSUE-005 fix), `allycat --version` will always reflect the bumped version automatically — no manual edits needed.

---

### `npm publish`

Uploads the package to [npmjs.com](https://npmjs.com) so anyone can install it:
```bash
npm install -g allycat
```

Only uploads the files listed in `"files"` in `package.json`:
- `src/**/*`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`

Everything else (`docs/`, `tests/`, `.claude/`) is excluded via `.npmignore`.

---

## Full Release Checklist (Every Time)

```bash
# 1. Make sure you're logged in
npm whoami

# 2. Bump the version (choose patch / minor / major)
npm version patch

# 3. Push the commit + tag to GitHub
git push && git push --tags

# 4. Final content check — confirm only expected files are in the package
npm pack --dry-run

# 5. Publish
npm publish --access public

# 6. Verify it's live
npm info allycat version

# 7. Smoke test from a clean install
npm install -g allycat
allycat --version   # must match the bumped version
npm uninstall -g allycat
```

---

## Decision Guide: Which Type to Use?

**`patch`** — something was broken and is now fixed. No new commands, no new options.
> Example: fixed `--changed` path comparison bug.

**`minor`** — added something new that users can optionally use. Existing usage still works.
> Example: added `--watch` flag, Vue transformer, Angular transformer.

**`major`** — changed something in a way that breaks existing usage.
> Example: renamed a flag, changed config file format, dropped Node 18 support.

**Rule of thumb:** when in doubt, use `patch` for fixes and `minor` for features. Use `major` sparingly — it signals to users that they need to read the changelog and possibly update their setup.

---

## Semantic Versioning (SemVer) in Short

Version numbers follow the format: `MAJOR.MINOR.PATCH`

- `MAJOR` — breaking changes
- `MINOR` — new features (backwards-compatible)
- `PATCH` — bug fixes (backwards-compatible)

This is the npm standard. Users and CI pipelines rely on it to decide whether to auto-update.
