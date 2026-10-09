# Release Workflow — How to Publish a New Version

> Internal reference. Covers: how the automated publish pipeline works, the full release checklist, and version type decision guide.

---

## How Publishing Works (Automated)

Publishing is handled automatically by the GitHub Actions workflow in `.github/workflows/publish.yml`.

**The trigger:** Creating a GitHub Release.

When you publish a GitHub Release, the workflow:
1. Installs dependencies
2. Runs a security audit (`npm audit`)
3. Validates the package contents (checks for unexpected files)
4. Runs E2E tests
5. Publishes to npm automatically

**You never run `npm publish` manually.**

**Only "Publish release" triggers it.** Pushing commits or pushing a tag on its own does not publish anything to npm.

---

## How npm Knows the Workflow Is Allowed (No Token)

Publishing uses **npm Trusted Publishing**. There is **no npm token and no GitHub secret** involved, so there is nothing to rotate or renew.

Think of it as a guest list at a door:

- **The guest list (set up once on npm):** the `allycat` package settings on npmjs.com list one trusted publisher: GitHub Actions, repo `AllyCatHQ/allycat-core`, workflow `publish.yml`.
- **The ID badge (created fresh every run):** when the workflow reaches `npm publish`, GitHub hands npm a short-lived ID that says "I am `publish.yml` from `AllyCatHQ/allycat-core`". The `id-token: write` permission in `publish.yml` is what lets the workflow ask for it.
- **The check:** npm compares the ID to the guest list. If they match, the version goes live.

Because of `--provenance`, each published version also shows a **Provenance** badge on npmjs.com that links back to the exact GitHub Actions run that built it.

### "Your access token is expiring" emails from npm

You can ignore them for releases. npm warns about every token on the account, whether or not anything uses it. Old tokens such as `github-actions-publish`, and the `NPM_TOKEN` secret in GitHub, date from before the switch to Trusted Publishing (June 2026). The workflow does not read them, and both can be deleted.

### If the "Publish" step fails with 401 / 403 / ENEEDAUTH

1. Check npmjs.com → `allycat` → **Settings** → **Trusted Publisher** still lists `AllyCatHQ/allycat-core` / `publish.yml`
2. Check the workflow file is still named `publish.yml` (renaming it breaks the match)
3. Check `publish.yml` still has `id-token: write` under `permissions`

Full setup details: [`docs/technical/ci-cd-workflows.md`](technical/ci-cd-workflows.md#trusted-publishing-setup)

---

## Full Release Checklist (Every Time)

```bash
# 1. Make sure you're on develop and up to date
git checkout develop
git pull

# 2. Update CHANGELOG.md — add a new section for the version
# Example: ## [1.1.0] - 2026-06-03

# 3. Bump the version in package.json (choose patch / minor / major)
npm version patch   # or minor / major

# 4. Push the commit and tag to GitHub
git push && git push --tags

# 5. Merge develop → main
# (via PR or direct merge)

# 6. Go to GitHub → Releases → Draft a new release
#    - Pick the tag you just pushed (e.g. v1.1.0)
#    - Title: v1.1.0 — Short Description
#    - Body: paste the relevant CHANGELOG section
#    - Click: Publish release

# 7. The workflow runs automatically — check it at:
#    GitHub repo → Actions → "Publish to npm"

# 8. Verify it's live (usually takes ~2 minutes)
npm info allycat version
```

---

## Decision Guide: Which Version Type?

| Command | When to use | Example |
|---|---|---|
| `npm version patch` | Bug fix, no new features | `1.0.0 → 1.0.1` |
| `npm version minor` | New feature, backwards-compatible | `1.0.0 → 1.1.0` |
| `npm version major` | Breaking change | `1.0.0 → 2.0.0` |

**Rule of thumb:** `patch` for fixes, `minor` for features, `major` sparingly — it signals to users they need to read the changelog and possibly update their setup.

---

## Semantic Versioning (SemVer)

Version numbers follow `MAJOR.MINOR.PATCH`:

- `MAJOR` — breaking changes (renamed flag, dropped Node version, config format change)
- `MINOR` — new features, backwards-compatible
- `PATCH` — bug fixes, backwards-compatible
