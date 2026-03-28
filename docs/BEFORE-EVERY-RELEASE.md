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
- [ ] Every question in the wizard matches an actual field in `allycat.config.json`
- [ ] Default values shown in prompts match actual defaults in `src/utils/configLoader.js`
- [ ] Supported standards listed in wizard match `STANDARDS` in `src/constants.js`
- [ ] Scan modes listed match `SCAN_MODES` in `src/constants.js`
- [ ] "Supported File Types" note reflects current `SUPPORTED_EXTENSIONS`
- [ ] No mention of features that don't exist yet or were removed

### `README.md`
- [ ] All flags in the README exist and behave as described
- [ ] All examples actually work (run at least one end-to-end)
- [ ] Supported file types section is current
- [ ] Installation command is correct (`npm install -g allycat`)
- [ ] Version referenced anywhere matches `package.json`

---

## 2. Vocabulary & Spelling Check

All strings visible to users — printed to terminal, written to reports, shown in help.

### Files to review:
- `src/commands/helpContent.js` — full read-through for typos
- `src/commands/init.js` — all prompts and messages
- `src/commands/outputters/terminalOutputter.js` — all terminal output strings
- `src/commands/outputters/summaryOutputter.js` — summary-mode strings
- `src/commands/outputters/jsonOutputter.js` — JSON output structure
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
**→ [`docs/contributing/functional-testing.md`](../contributing/functional-testing.md)**

Quick summary of what must pass before release:

### Lint — must pass clean
```bash
npm run lint    # expect: no output, exit 0
```

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

## 4. URL Verification

Every URL visible to users — in the README, help output, HTML report, and package.json — must open the correct page.

### `package.json`
- [ ] `homepage` opens the correct GitHub repo page
- [ ] `bugs.url` opens the GitHub Issues tab
- [ ] `repository.url` is the correct git remote

### `README.md`
- [ ] All badge links open the correct target (npm page, CI workflow, license)
- [ ] All code example links and external references resolve correctly
- [ ] No `localhost`, placeholder, or expired URLs remain

### `src/commands/helpContent.js`
- [ ] Every URL printed in help output (`allycat --help`) opens the correct page
- [ ] WCAG / IS 5568 reference links resolve
- [ ] No dead links or placeholder URLs

### `src/engine/report/generator.js` — HTML report
- [ ] VS Code `vscode://` deep-links are correctly formatted
- [ ] Any external links in the report (e.g. axe rule references) open the correct pages

---

## 5. Legal & Attribution Check

Verify that all code and assets in the published bundle are legally cleared.

### Dependency licenses
```bash
npx license-checker --production --summary
```
- [ ] All production dependencies use permissive licenses (MIT, ISC, BSD, Apache 2.0)
- [ ] No GPL, LGPL, AGPL, or unknown-license packages in `dependencies` (devDependencies are excluded from the bundle)
- [ ] If any copyleft license appears — stop and investigate before publishing

### Code ownership
- [ ] No copy-pasted code blocks from Stack Overflow, blog posts, or other projects without attribution
- [ ] Any code adapted from open-source projects has the original license/author credited in a comment
- [ ] No AI-generated code that reproduces verbatim copyrighted material

### Assets
- [ ] `assets/icon.png` — confirm you own or have a license for the logo
- [ ] `assets/demo.gif` — confirm it only shows your own tool output (no third-party UI)
- [ ] No fonts, icons, or images embedded in `src/engine/report/generator.js` that require attribution

### axe-core
- [ ] axe-core is MIT licensed — no special attribution required beyond listing it as a dependency
- [ ] `axe-core` and `@axe-core/playwright` are in `dependencies` / `devDependencies` correctly

---

## 6. Configuration Accuracy

- [ ] `allycat init` followed by `allycat scan .` works on a fresh project with no existing config
- [ ] Config fields in generated `allycat.config.json` match what `configLoader.js` actually reads
- [ ] Concurrency: run `allycat init` and confirm the displayed parallel count is correct for this machine
- [ ] `--version` output matches `"version"` in `package.json`

---

## 7. Version Bump Decision

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

## 8. Package Content Check

```bash
npm pack --dry-run
```

- [ ] Only these paths appear: `src/`, `README.md`, `LICENSE`, `package.json`
- [ ] No `tests/`, `docs/`, `.claude/`, `.env`, or debug files leaked
- [ ] `README.md` is included (check `.npmignore` has `!README.md`)

---

## 9. Final Smoke Test (After Pack, Before Publish)

```bash
npm pack
npm install -g allycat-<version>.tgz

cd /tmp/smoke-test   # or any directory outside this project
allycat --version                  # must match package.json version
allycat --help                     # must render without errors
allycat init                       # run through wizard, accept defaults
allycat scan .                     # must complete without crash

npm uninstall -g allycat
rm allycat-<version>.tgz
```

- [ ] `--version` matches expected version
- [ ] `--help` renders correctly, no placeholder text
- [ ] `init` completes and writes `allycat.config.json`
- [ ] `scan .` completes (violations or clean — either is fine, no crash)

---

## 10. Publish

```bash
npm whoami                   # confirm logged in
npm publish --access public
npm info allycat version   # confirm live version updated
```

- [ ] Published successfully
- [ ] Live version on npmjs.com matches expected version
- [ ] Post-publish: fresh install test (`npm install -g allycat && allycat --version`)
