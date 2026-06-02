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

---

## NPM_TOKEN Secret — Maintenance

The workflow authenticates to npm using the `NPM_TOKEN` secret stored in GitHub.

**Location:** GitHub repo → Settings → Secrets and variables → Actions → `NPM_TOKEN`

**Important:** This token must be set to **No expiration** when generated on npmjs.com.
If it expires, the publish step will fail silently with a 401 error.

**How to rotate the token (if ever needed):**
1. Go to npmjs.com → Avatar → Access Tokens → Generate New Token (Granular)
2. Set **Packages and scopes → Permissions** to `Read and write`
3. Set **Expiration** to `No expiration`
4. Copy the token
5. Go to GitHub repo → Settings → Secrets and variables → Actions
6. Delete the old `NPM_TOKEN` → Add new secret with the same name

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
