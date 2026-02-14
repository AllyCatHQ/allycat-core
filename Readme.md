# A11y-Guard CLI

## Setup
```bash
npm link
```

## Commands

### Initialize Configuration
```bash
a11y-guard init
```

### Scan for Accessibility Issues
```bash
# Default scan (uses config setting)
a11y-guard scan

# Quick scan - fast, no contrast check (JSDOM)
a11y-guard scan --quick

# Full scan - slower, with contrast check (Playwright)
a11y-guard scan --full

# Scan specific file or folder
a11y-guard scan src/components
a11y-guard scan src/pages/Home.html --full

# JSON output (for CI/CD)
a11y-guard scan --output json
a11y-guard scan --full --output json
```

## Requirements for Full Scan
```bash
npm install playwright @axe-core/playwright
npx playwright install chromium
```