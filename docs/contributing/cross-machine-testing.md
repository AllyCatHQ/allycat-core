# A11y-Guard: Cross-Machine Testing Guide

> Last updated: 2026-03-09
> Status legend: ✅ Done · ⬜ Still needed · 🔴 Blocker · 🟡 Should do · 🔵 Nice to have

---

## 1. Target Environment Matrix

### OS Matrix

| OS | Priority | Notes |
|---|---|---|
| Windows 11 (dev machine) | Primary | PowerShell + bash (Git Bash / WSL) |
| macOS 14+ (Sonoma) | High | zsh default shell, homebrew Node |
| Ubuntu 22.04 LTS | High | CI baseline, Docker image |
| Ubuntu 24.04 LTS | Medium | Next LTS — forward compat |

### Node.js Versions

From `package.json` `engines: { "node": ">=18.0.0" }`:

| Version | Status | Notes |
|---|---|---|
| Node 18 LTS | Required minimum | Oldest supported — must work |
| Node 20 LTS | Primary | Current CI standard (GitHub Actions default) |
| Node 22 LTS | Should pass | Current active LTS as of 2026 |

### Shell Environments

| Shell | OS | Test |
|---|---|---|
| bash (Git Bash) | Windows | Path separators, npm link |
| PowerShell 7 | Windows | Path quoting, exit code `$LASTEXITCODE` |
| zsh | macOS | Default shell on macOS |
| bash | Linux / Docker | Standard CI shell |

---

## 2. Environment Setup — Exact Commands Per OS

### 2a. macOS

```bash
# 1. Install Node.js via nvm (recommended over homebrew for version switching)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.zshrc
nvm install 20
nvm use 20
node --version   # → v20.x.x

# 2. Clone or copy the project
git clone https://github.com/A11yGuard/A11yGuard-Core.git
cd A11yGuard-Core

# 3. Install dependencies
npm install

# 4. Link globally for local testing
npm link
which a11y-guard   # → /Users/<you>/.nvm/versions/node/v20.x.x/bin/a11y-guard

# 5. Install Playwright Chromium for --full mode
npx playwright install chromium
# Chromium is stored in: ~/.cache/ms-playwright/

# 6. Verify
a11y-guard --version
```

### 2b. Linux (Ubuntu 22.04 / 24.04)

```bash
# 1. Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 2. Install system dependencies required by Playwright
sudo apt-get update
sudo apt-get install -y \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
  libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
  libasound2 libatspi2.0-0 libxfixes3 libxext6

# 3. Clone or copy the project
git clone https://github.com/A11yGuard/A11yGuard-Core.git
cd A11yGuard-Core

# 4. Install dependencies
npm install

# 5. Link globally
npm link
which a11y-guard   # → /home/<you>/.nvm/versions/node/v20.x.x/bin/a11y-guard

# 6. Install Playwright Chromium
npx playwright install chromium
# Chromium is stored in: ~/.cache/ms-playwright/

# 7. Verify
a11y-guard --version
```

### 2c. Windows (Git Bash)

```bash
# 1. Install Node.js via nvm-windows (https://github.com/coreybutler/nvm-windows)
# After nvm-windows install:
nvm install 20
nvm use 20
node --version

# 2. Clone the project
git clone https://github.com/A11yGuard/A11yGuard-Core.git
cd "A11yGuard-Core"

# 3. Install dependencies
npm install

# 4. Link globally
npm link
# Binary resolves to: %APPDATA%\npm\a11y-guard.cmd

# 5. Install Playwright Chromium (run in Git Bash or PowerShell)
npx playwright install chromium
# Chromium is stored in: %USERPROFILE%\AppData\Local\ms-playwright\

# 6. Verify
a11y-guard --version
```

### 2d. Windows (PowerShell 7)

```powershell
# After npm link is done (see Git Bash steps above):
a11y-guard --version

# Check exit codes in PowerShell (not $? — use $LASTEXITCODE):
a11y-guard scan tests/fixtures/fail-on-critical.html --fail-on-critical
echo $LASTEXITCODE   # → 1
```

### 2e. Testing from a tarball (simulates npm install -g)

Run this from inside the project root on any OS:

```bash
# 1. Pack
npm pack
# → a11y-guard-1.0.0.tgz

# 2. Install globally from tarball
npm install -g a11y-guard-1.0.0.tgz

# 3. Test in a separate directory (no local node_modules)
mkdir /tmp/a11y-test-project
cd /tmp/a11y-test-project
a11y-guard --version
a11y-guard init

# 4. Cleanup
npm uninstall -g a11y-guard
rm ~/A11yGuard-Core/a11y-guard-1.0.0.tgz
```

---

## 3. Testing Without a Second Machine — Docker

Docker provides a clean Linux environment on any host OS (Windows, macOS, Linux) and is the fastest way to validate a tarball install on a fresh machine.

### 3a. Dockerfile

Create this file temporarily at the project root (do not commit it — it is not needed in the repo):

```dockerfile
# Save as: Dockerfile.crosstest (do not commit)
FROM node:20-bookworm-slim

# Install Playwright system dependencies
RUN apt-get update && apt-get install -y \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 \
    libasound2 libatspi2.0-0 libxfixes3 libxext6 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the packed tarball (run npm pack first)
COPY a11y-guard-*.tgz ./

# Install globally from tarball
RUN npm install -g a11y-guard-*.tgz

# Install Playwright Chromium inside the container
RUN npx playwright install chromium --with-deps

# Copy test fixtures into a test project directory
COPY tests/fixtures/ /test-project/

WORKDIR /test-project

# Smoke test: run on entry
CMD ["bash"]
```

### 3b. Build and Run Commands

```bash
# From the project root:

# Step 1: Pack the tarball
npm pack

# Step 2: Build the Docker image
docker build -f Dockerfile.crosstest -t a11y-guard-crosstest .

# Step 3: Run interactive shell
docker run --rm -it a11y-guard-crosstest bash

# Inside the container — run the full test suite:
a11y-guard --version
a11y-guard init   # (non-interactive — Ctrl+C after confirming it launches)

# Then run individual test commands from Section 4 below
```

### 3c. Non-Interactive Docker Smoke Test

```bash
# Run a one-liner smoke test (no interactive shell needed):
docker run --rm a11y-guard-crosstest \
  bash -c "a11y-guard --version && \
           a11y-guard scan /test-project/sample.html && \
           a11y-guard scan /test-project/fail-on-critical.html --fail-on-critical; \
           echo EXIT:$?"
# Expected last line: EXIT:1
```

### 3d. GitHub Actions (CI Verification)

The `README.md` already includes a GitHub Actions workflow. To specifically test cross-platform behavior, use a matrix job:

```yaml
# .github/workflows/cross-platform.yml  (add to repo before publishing)
name: Cross-Platform Smoke Test

on: [push, pull_request]

jobs:
  smoke:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: ['18', '20', '22']
    runs-on: ${{ matrix.os }}

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}

      - name: Install from source
        run: npm install && npm link

      - name: Install Playwright Chromium
        run: npx playwright install chromium

      - name: Version check
        run: a11y-guard --version

      - name: Quick scan (HTML fixture)
        run: node src/index.js scan tests/fixtures/sample.html

      - name: Exit code test (critical file → exit 1)
        run: |
          node src/index.js scan tests/fixtures/fail-on-critical.html --fail-on-critical
          # should exit 1
        continue-on-error: true   # expected to fail — checked by next step

      - name: E2E thresholds test
        run: node tests/e2e/thresholds.test.js
```

---

## 4. Functional Test Suite

On each target machine, run the complete functional test suite to verify all features work correctly.

**Full test list with exact commands and expected output:**
→ [`docs/private/functional-testing.md`](functional-testing.md)

> Prerequisites on each machine:
> - `npm link` completed (or installed from tarball — see Section 2e)
> - `a11y-config.json` present (run `a11y-guard init` once)
> - Playwright Chromium installed for `--full` tests: `npx playwright install chromium`

The sections below (5–8) cover **platform-specific** behavior that goes beyond functional correctness — things that only matter when running on a different OS, shell, or Node version.

---

### 4.1 Minimum smoke-check per machine

Run these five commands on each target environment to confirm the installation is healthy before running the full suite:

```bash
a11y-guard --version
a11y-guard --help
a11y-guard init         # run through wizard, accept defaults
node src/index.js scan tests/fixtures/sample.html
node tests/e2e/thresholds.test.js    # expect: 8/8 passed
```

For the complete feature-by-feature test list (all file types, output modes, standards, RTL, watch mode, exit codes, etc.) see:
**→ [`docs/private/functional-testing.md`](functional-testing.md)**

---

### 4.2 Version check (cross-machine specific)

- ⬜ **Version matches package.json**
  ```bash
  a11y-guard --version
  ```
  Expected: prints the version string from `package.json` (e.g. `1.0.0`).
  Not a hardcoded string — verify it matches `cat package.json | grep '"version"'`.

> All remaining feature tests (init wizard, scan modes, file types, output modes, exit codes, standards, RTL, watch mode, `--changed`, CSS delivery) are documented in:
> **→ [`docs/private/functional-testing.md`](functional-testing.md)**
> Run the full checklist on each target machine before signing off.

---

## 5. Platform-Specific Edge Cases

### 6a. Path Separators (Windows vs macOS/Linux)

- ⬜ **Backslash path on Windows**
  ```powershell
  node src/index.js scan tests\fixtures\sample.html
  ```
  Expected: scan runs normally (same as forward slash). Exit 0.

- ⬜ **Mixed separators in scan target**
  ```bash
  node src/index.js scan tests/fixtures\sample.html
  ```
  Expected: path resolved correctly. Exit 0.

- ⬜ **--changed scope with backslash (Windows)**
  ```powershell
  node src/index.js scan tests\fixtures --changed
  ```
  Expected: only files inside `tests\fixtures` scanned. Not zero files, not the whole project.
  (Regression guard for ISSUE-006 fix.)

- ⬜ **Absolute path scan**
  ```bash
  # macOS/Linux:
  node src/index.js scan /absolute/path/to/tests/fixtures/sample.html
  # Windows Git Bash:
  node src/index.js scan "C:/Users/dotan/Docs/Vs Projects/Projects/A11yGuard Core/tests/fixtures/sample.html"
  ```
  Expected: file found and scanned. Exit 0.

### 6b. BOM-Encoded Files (Windows — ISSUE-001)

- ⬜ **UTF-8 BOM file scanned correctly**
  ```bash
  # Create a UTF-8 BOM fixture:
  node -e "
    const fs = require('fs');
    const content = '<html lang=\"en\"><head><title>t</title></head><body><img src=\"x\"></body></html>';
    fs.writeFileSync('/tmp/bom-test.html', '\uFEFF' + content, 'utf8');
  "
  node src/index.js scan /tmp/bom-test.html
  ```
  Expected: `image-alt` violation found (not garbled output). Line number is 1. Exit 0.

- ⬜ **UTF-16 LE file scanned correctly**
  ```bash
  node -e "
    const fs = require('fs');
    const content = '<html lang=\"en\"><head><title>t</title></head><body><img src=\"x\"></body></html>';
    const buf = Buffer.from('\xFF\xFE', 'binary');
    const utf16 = Buffer.from(content, 'utf16le');
    fs.writeFileSync('/tmp/utf16-test.html', Buffer.concat([buf, utf16]));
  "
  node src/index.js scan /tmp/utf16-test.html
  ```
  Expected: `image-alt` violation found. No garbled content warnings. Exit 0.

  > **Note:** Never create test fixture files with the Write tool on this Windows machine —
  > it writes UTF-16 LE. Always use `node -e "require('fs').writeFileSync(..., 'utf8')"`.

### 6c. Playwright Chromium Install Path Differences

| OS | Chromium cache location |
|---|---|
| Windows | `%USERPROFILE%\AppData\Local\ms-playwright\` |
| macOS | `~/Library/Caches/ms-playwright/` |
| Linux | `~/.cache/ms-playwright/` |
| Docker (root) | `/root/.cache/ms-playwright/` |

- ⬜ **Full scan works on macOS (Chromium path resolved)**
  ```bash
  node src/index.js scan tests/fixtures/sample.html --full
  ```
  Expected: Chromium launches without path errors. Exit 0.

- ⬜ **Full scan works on Linux (Chromium path resolved)**
  ```bash
  node src/index.js scan tests/fixtures/sample.html --full
  ```
  Expected: same. Exit 0.

- ⬜ **Chromium not installed — clear error**
  ```bash
  # On a machine where npx playwright install chromium has NOT been run:
  node src/index.js scan tests/fixtures/sample.html --full
  ```
  Expected: clear error message: "Chromium not found — run: `npx playwright install chromium`".
  Does not print a raw Node.js stack trace. Exits non-zero.

### 6d. npm link / Global Install Paths

- ⬜ **npm link — binary resolves correctly**
  ```bash
  which a11y-guard        # macOS/Linux
  where a11y-guard        # Windows CMD
  get-command a11y-guard  # PowerShell
  ```
  Expected: path returned points to the linked binary (not undefined or "not found").

- ⬜ **Global tarball install — no local node_modules needed**
  ```bash
  # In a directory with no node_modules:
  mkdir /tmp/clean-project && cd /tmp/clean-project
  a11y-guard --version
  a11y-guard scan /path/to/tests/fixtures/sample.html
  ```
  Expected: tool works without needing a local `node_modules`. Exit 0.

- ⬜ **npm pack --dry-run — only expected files in bundle**
  ```bash
  npm pack --dry-run
  ```
  Expected output includes:
  - `src/**/*`
  - `README.md`
  - `LICENSE`
  - `package.json`
  NOT included: `tests/`, `docs/`, `.claude/`, `Dockerfile.crosstest`, `*.tgz`

---

## 6. Node.js Version Matrix Tests

Run these after switching Node versions (use `nvm use <version>`):

- ⬜ **Node 18 — version check and quick scan**
  ```bash
  nvm use 18
  node --version   # → v18.x.x
  node src/index.js scan tests/fixtures/sample.html
  ```
  Expected: scan completes without syntax errors. ESM imports work. Exit 0.

- ⬜ **Node 20 — version check and full suite**
  ```bash
  nvm use 20
  node --version   # → v20.x.x
  node tests/e2e/thresholds.test.js
  ```
  Expected: `8/8 passed`. Exit 0.

- ⬜ **Node 22 — forward compatibility**
  ```bash
  nvm use 22
  node --version   # → v22.x.x
  node src/index.js scan tests/fixtures/sample.html
  node src/index.js scan tests/fixtures/sample.html --full
  ```
  Expected: both quick and full scan complete without deprecation errors or crashes. Exit 0.

---

## 7. E2E Automated Tests

Run all three automated E2E scripts in sequence:

```bash
# Prerequisites: a11y-config.json exists, Playwright Chromium installed

node tests/e2e/thresholds.test.js
# Expected: 8/8 passed

node tests/e2e/concurrency.test.js
# Expected: prints Machine RAM, Quick ceiling, Full ceiling — no crash

node tests/e2e/css-delivery.test.js
# Expected: all [ACTIVE] assertions pass (uses --full — requires Playwright)
```

- ⬜ All three E2E scripts pass on Windows
- ⬜ All three E2E scripts pass on macOS
- ⬜ All three E2E scripts pass on Linux / Docker

---

## 8. Pre-Publish Smoke Test (Tarball)

Run after `npm pack` before publishing:

```bash
# 1. Pack
npm pack
# → a11y-guard-1.0.0.tgz

# 2. Install globally from tarball into a different directory
cd /tmp
npm install -g ~/path/to/A11yGuard-Core/a11y-guard-1.0.0.tgz

# 3. Run in a clean test project
mkdir /tmp/smoke-project && cd /tmp/smoke-project
a11y-guard --version
a11y-guard init
a11y-guard scan /path/to/tests/fixtures/sample.html
a11y-guard scan /path/to/tests/fixtures/sample.html --summary
a11y-guard scan /path/to/tests/fixtures/sample.html --full
a11y-guard scan /path/to/tests/fixtures/sample.html -o json
a11y-guard scan /path/to/tests/fixtures/fail-on-critical.html --fail-on-critical; echo "Exit: $?"

# 4. Clean up
npm uninstall -g a11y-guard
rm ~/path/to/A11yGuard-Core/a11y-guard-1.0.0.tgz
```

- ⬜ Tarball smoke test passes on Windows
- ⬜ Tarball smoke test passes on macOS
- ⬜ Tarball smoke test passes on Linux / Docker

---

## 9. Sign-Off Checklist

- ⬜ All Section 4 tests pass on Windows (dev machine)
- ⬜ All Section 4 tests pass on macOS or Linux (second machine / Docker)
- ⬜ Node 18, 20, 22 all pass quick scan and E2E thresholds test
- ⬜ --full mode (Playwright) works on both Windows and non-Windows
- ⬜ Chromium-not-found error message is clear and actionable
- ⬜ BOM / UTF-16 files scanned without garbled output
- ⬜ Path separators (\ and /) both work on Windows for scan targets and --changed scope
- ⬜ npm pack --dry-run shows only expected files (no test/ or docs/ in bundle)
- ⬜ Tarball install + smoke test passed on at least two OS targets
- ⬜ All three E2E test scripts pass on at least one non-Windows machine
