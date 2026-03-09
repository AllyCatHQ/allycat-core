# Before Every Release — Pre-Upload Gate

> Run this checklist before every `npm version` + `npm publish`, no matter how small the change.
> Status keys: ✅ Done · ⬜ Pending · 🔴 Blocker

---

## 1. User-Facing Accuracy ("Not Lying" Check)

Verify that what the tool **tells** users matches what it **does**.

### `src/commands/helpContent.js`
- [ ] Every flag listed in help output exists and works as described
- [ ] No flag is described with outdated behavior (e.g. old defaults, removed options)
- [ ] Concurrency description in help is accurate — auto mode is documented, override path is explained
- [ ] Supported file types list matches `SUPPORTED_EXTENSIONS` in `src/constants.js`
- [ ] Exit codes documented in help match actual exit codes in `src/commands/scanResultHandler.js`

### `src/commands/init.js` — Init Wizard
- [ ] Every question in the wizard matches an actual field in `a11y-config.json`
- [ ] Default values shown in prompts match actual defaults in `src/utils/configLoader.js`
- [ ] Supported standards listed in wizard match `STANDARDS` in `src/constants.js`
- [ ] Scan modes listed match `SCAN_MODES` in `src/constants.js`
- [ ] "Supported File Types" note reflects current `SUPPORTED_EXTENSIONS`
- [ ] No mention of features that don't exist yet or were removed

### `README.md`
- [ ] All flags in the README exist and behave as described
- [ ] All examples actually work (run at least one end-to-end)
- [ ] Supported file types section is current
- [ ] Installation command is correct (`npm install -g a11yguard-core`)
- [ ] Version referenced anywhere matches `package.json`

---

## 2. Vocabulary & Spelling Check

All strings visible to users — printed to terminal, written to reports, shown in help.

### Files to review:
- `src/commands/helpContent.js` — full read-through for typos
- `src/commands/init.js` — all prompts and messages
- `src/commands/scanOutputters.js` — all terminal output strings
- `src/engine/report/generator.js` — all HTML report strings
- `src/constants.js` — any user-visible labels or messages

### What to look for:
- [ ] No spelling errors in any printed string
- [ ] Consistent capitalization (e.g. "WCAG 2.1 AA" not "wcag2aa" in user messages)
- [ ] No leftover debug strings, TODOs, or placeholder text visible to users
- [ ] Consistent tone — all messages match the voice of the tool (e.g. no mix of "scanning" vs "analyzing" for the same action)
- [ ] Numbers and defaults are correct and consistent across all files

---

## 3. Test Gate

Full functional test checklist (all features, all file types, all output modes):
**→ [`docs/private/functional-testing.md`](../private/functional-testing.md)**

Quick summary of what must pass before release:

### E2E Tests — automated, must all pass
```bash
node tests/e2e/thresholds.test.js    # exit codes — expect 8/8 passed
node tests/e2e/concurrency.test.js   # RAM-aware ceilings — expect no crash
node tests/e2e/css-delivery.test.js  # CSS features — expect 15/15 passed
```

### Minimum manual spot-check
```bash
node src/index.js scan tests/fixtures/sample.html
node src/index.js scan tests/fixtures/sample.vue
node src/index.js scan tests/fixtures/sample.component.html
node src/index.js scan tests/fixtures/fail-on-critical.html --fail-on-critical
node src/index.js scan tests/fixtures/fail-on-clean.html
```
- [ ] Violations reported for the first three files (see `functional-testing.md` for exact expected output)
- [ ] `fail-on-critical.html --fail-on-critical` → exit code 1
- [ ] `fail-on-clean.html` → exit code 0 and no violations

---

## 4. Configuration Accuracy

- [ ] `a11y-guard init` followed by `a11y-guard scan .` works on a fresh project with no existing config
- [ ] Config fields in generated `a11y-config.json` match what `configLoader.js` actually reads
- [ ] Concurrency: run `a11y-guard init` and confirm the displayed parallel count is correct for this machine
- [ ] `--version` output matches `"version"` in `package.json`

---

## 5. Version Bump Decision

Decide which type of bump is correct before running `npm version`:

| Change type | Bump |
|---|---|
| Bug fix only, no new behavior | `patch` |
| New flag, transformer, or feature | `minor` |
| Renamed flag, changed config format, dropped Node version | `major` |

- [ ] Bump type chosen: **`_______`**
- [ ] Changelog mentally noted (what changed since last publish)

```bash
npm version patch   # or minor / major
```

---

## 6. Package Content Check

```bash
npm pack --dry-run
```

- [ ] Only these paths appear: `src/`, `README.md`, `LICENSE`, `package.json`
- [ ] No `tests/`, `docs/`, `.claude/`, `.env`, or debug files leaked
- [ ] `README.md` is included (check `.npmignore` has `!README.md`)

---

## 7. Final Smoke Test (After Pack, Before Publish)

```bash
npm pack
npm install -g a11yguard-core-<version>.tgz

cd /tmp/smoke-test   # or any directory outside this project
a11y-guard --version                  # must match package.json version
a11y-guard --help                     # must render without errors
a11y-guard init                       # run through wizard, accept defaults
a11y-guard scan .                     # must complete without crash

npm uninstall -g a11yguard-core
rm a11yguard-core-<version>.tgz
```

- [ ] `--version` matches expected version
- [ ] `--help` renders correctly, no placeholder text
- [ ] `init` completes and writes `a11y-config.json`
- [ ] `scan .` completes (violations or clean — either is fine, no crash)

---

## 8. Publish

```bash
npm whoami                   # confirm logged in
npm publish --access public
npm info a11yguard-core version   # confirm live version updated
```

- [ ] Published successfully
- [ ] Live version on npmjs.com matches expected version
- [ ] Post-publish: fresh install test (`npm install -g a11yguard-core && a11y-guard --version`)
