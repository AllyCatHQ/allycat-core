# CI/CD Workflows

AllyCat Core uses five GitHub Actions workflows. This document explains what each one does, when it runs, what it checks, and how to maintain it.

---

## Overview

| Workflow | File | Triggers | Purpose |
|---|---|---|---|
| CI | `ci.yml` | push to `main`, any PR | Lint + security audit + E2E tests |
| Cross-Platform | `cross-platform.yml` | push to `main` or `develop`, any PR | Smoke tests across OS × Node matrix |
| Dependency Review | `dependency-review.yml` | PRs only | Blocks PRs that add vulnerable dependencies |
| CodeQL | `codeql.yml` | push to `main`, any PR, weekly | Static security analysis |
| Publish | `publish.yml` | GitHub Release published | Gated automated publish to npm |

---

## 1. CI (`ci.yml`)

**Runs on:** ubuntu-latest
**Triggers:** every push to `main` and every pull request

### Steps
1. `npm ci` — clean install from lock file
2. `npm audit --audit-level=high` — fails if any dependency has a high/critical CVE
3. `npm run lint` — ESLint over `src/`
4. `node tests/e2e/thresholds.test.js` — verifies `--fail-on-*` exit codes are correct
5. `node tests/e2e/concurrency.test.js` — verifies concurrency clamping behavior

### What fails it
- A dependency with a known CVE at `high` or `critical` severity
- Any ESLint error in `src/`
- Wrong exit code from the scanner (e.g. threshold flags broken)
- Concurrency exceeding RAM-derived ceiling

---

## 2. Cross-Platform (`cross-platform.yml`)

**Runs on:** ubuntu-latest, macos-latest, windows-latest × Node 20, Node 22
**Triggers:** every push to `main` or `develop`, and every pull request

### Steps
1. `node src/index.js --version` — confirms the CLI boots on all platforms
2. Quick scan of `tests/fixtures/sample.html` — confirms scan pipeline works
3. Full E2E threshold + concurrency tests
4. `allycat fix` E2E tests — `fix`, `fix-freshness`, `fix-claude-check`, `terminal-opener`, `fix-prompt-size`
5. (Ubuntu only) Playwright install + CSS delivery E2E test

### What fails it
- CLI crashes on boot on any OS/Node combination
- Scan pipeline throws on a known-good fixture
- `allycat fix` regression on any OS (e.g. terminal opening, Claude Code detection, PATH handling)
- CSS delivery regression (Ubuntu only)

---

## 3. Dependency Review (`dependency-review.yml`)

**Runs on:** ubuntu-latest
**Triggers:** pull requests only

Checks every new or updated dependency in the PR against the GitHub Advisory Database. Posts a summary comment directly on the PR.

### What fails it
- A new dependency (or version bump) has a known advisory at `high` or `critical` severity
- The PR will be blocked at the checks level until the dep is removed or upgraded

### Notes
- Does **not** run on push to `main` — only on PRs, before merge
- Requires `pull-requests: write` permission to post the comment (already set in the workflow)

---

## 4. CodeQL (`codeql.yml`)

**Runs on:** ubuntu-latest
**Triggers:** push to `main`, all PRs, and every Monday at 08:00 UTC

Runs GitHub's static analysis engine against `src/`. Uses the `security-and-quality` query suite, which covers:

- Path traversal (relevant: user-supplied file paths)
- ReDoS — catastrophic regex backtracking (relevant: regex run on arbitrary source files)
- Prototype pollution
- Command injection
- Common logic errors (unreachable code, missing null checks)

### What fails it
- Any finding from the `security-and-quality` query suite
- Results appear in the GitHub Security tab → Code scanning alerts

### Notes
- Results are visible only to repo maintainers (not public)
- The weekly cron catches regressions introduced by dependency updates that don't come through a PR

---

## 5. Publish (`publish.yml`)

**Runs on:** ubuntu-latest
**Triggers:** when a GitHub Release is published (not a draft)

### Steps
1. `npm ci`
2. `npm audit --audit-level=high` — publish is aborted if any CVE found
3. Pack validation — runs `npm pack --dry-run` and fails if test fixtures or dotfiles appear in the output (guards against accidental file leaks or missing `src/` files)
4. `node tests/e2e/thresholds.test.js`
5. `node tests/e2e/concurrency.test.js`
6. `npm publish --access public --provenance` — publishes to the npm registry with a provenance attestation

### What fails it
- Any CVE in the dependency tree
- `tests/` or `.env` files present in the packed output
- Either E2E test failing

### Authentication method
This workflow uses **npm Trusted Publishing (OIDC)** — no token or secret is stored anywhere.
GitHub and npm authenticate via a cryptographic handshake at publish time.
See [Trusted Publishing setup](#trusted-publishing-setup) below.

---

## Trusted Publishing setup

> **Status: DONE** (configured 2026-06-03, commit `d263bf9`). Every release since 1.2.0 has published this way.
> Nothing needs renewing. Only revisit this section if the npm settings or `publish.yml` change.

### npm side (package settings)

npmjs.com → `allycat` package → **Settings** → **Trusted Publisher**, configured as:
- **Publisher:** GitHub Actions
- **Repository owner:** `AllyCatHQ`
- **Repository name:** `allycat-core`
- **Workflow filename:** `publish.yml`
- **Environment:** blank

### Workflow side (`publish.yml`)

These parts must stay in place, or npm will reject the publish:
- `permissions: id-token: write`, which lets the job request the short-lived OIDC identity from GitHub
- `registry-url: 'https://registry.npmjs.org'` on `actions/setup-node`
- `npm publish --access public --provenance`, with **no** `NODE_AUTH_TOKEN` env var
- The file name `publish.yml`, because npm matches on it. Renaming the file means updating the npm setting too.

### Leftover tokens

The `NPM_TOKEN` GitHub secret and the npm granular token `github-actions-publish` belong to the old token-based setup. The workflow does not reference them. npm's "token expiring" emails about them can be ignored, and both can be deleted.

### Why Trusted Publishing instead of a token?

- **No secret to store, rotate, or leak** — the token approach requires storing a credential in GitHub Secrets; Trusted Publishing has nothing to steal
- **npm recommends it** — they show a warning when you try to bypass 2FA with a token for CI use
- **Provenance** — npm can cryptographically link each published version back to the exact GitHub Actions run that produced it, visible on the package page

---

## Adding a new workflow

When adding a new workflow file:

1. Place it in `.github/workflows/`
2. Add it to the table at the top of this document
3. Document what triggers it, what it checks, and what causes it to fail
4. If it needs a secret, document the setup steps in this file

---

## Local equivalents

Everything CI runs can be run locally:

```bash
npm audit                          # dependency CVE check
npm run lint                       # ESLint
npm test                           # full E2E suite (see "test" in package.json)
npm pack --dry-run                 # preview what gets published
node tests/e2e/css-delivery.test.js  # CSS delivery (requires Playwright)
```
