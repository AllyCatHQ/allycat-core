# Contributing to AllyCat

Thank you for your interest in contributing to AllyCat! This document provides guidelines and instructions for contributing.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Be kind, constructive, and professional in all interactions.

---

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- Git

### Fork and Clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/allycat.git
cd allycat
```

---

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Optional Dependencies (for full scan testing)

```bash
npm install playwright @axe-core/playwright
npx playwright install chromium
```

### 3. Link for Local Development

```bash
# Create global symlink to your local code
npm link

# Now you can test from anywhere
allycat --version
```

### 4. Unlink When Done

```bash
npm unlink -g allycat
```

---

## Project Structure

```
allycat/
├── src/
│   ├── index.js              # CLI entry point & command definitions
│   ├── constants.js          # Shared constants
│   │
│   ├── commands/
│   │   ├── init.js           # `allycat init` command
│   │   ├── scan.js           # `allycat scan` command
│   │   └── help.js           # `allycat help` command
│   │
│   ├── engine/
│   │   ├── quickScanner.js   # JSDOM-based scanning (fast)
│   │   └── fullScanner.js    # Playwright-based scanning (full)
│   │
│   └── utils/
│       ├── configLoader.js   # Config file operations
│       ├── pathUtils.js      # Cross-platform path handling
│       ├── scannerUtils.js   # Shared scanner utilities
│       ├── sourceMapper.js   # Line number detection
│       └── violationFormatter.js  # Output formatting
│
├── test-files/               # Test HTML files (not published to npm)
│   └── *.html
│
├── .gitignore
├── .npmignore
├── package.json
├── README.md
├── CONTRIBUTING.md           # This file
└── LICENSE
```

### Key Architectural Decisions

| Decision | Reason |
|----------|--------|
| Dual scanner (quick/full) | JSDOM can't check contrast; Playwright is slow |
| Shared utilities | DRY principle, consistent behavior |
| Source mapping | Line numbers improve developer experience |
| Commander.js | Industry-standard CLI framework |

---

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Changes

- Keep changes focused and minimal
- Follow coding standards (below)
- Test your changes locally

### 3. Test Locally

```bash
# Test in the project folder
node src/index.js scan ./test-files

# Or if linked globally
allycat scan ./test-files
```

### 4. Commit Your Changes

Follow [Conventional Commits](#commit-guidelines) format.

### 5. Push and Create PR

```bash
git push origin feat/your-feature-name
```

Then create a Pull Request on GitHub.

---

## Coding Standards

### General Principles

- **Clean Code** — Readable, maintainable, self-documenting
- **Single Responsibility** — Each function does one thing
- **DRY** — Don't Repeat Yourself; use shared utilities
- **Small Functions** — Keep functions under 30 lines when possible

### JavaScript Style

```javascript
// ✅ Good: Clear naming, JSDoc, focused function
/**
 * Format violation count by severity level
 * 
 * @param {Array} violations - Array of violation objects
 * @returns {Object} - Counts grouped by impact level
 */
export function countByImpact(violations) {
    return violations.reduce((acc, v) => {
        acc[v.impact] = (acc[v.impact] || 0) + 1;
        return acc;
    }, {});
}

// ❌ Bad: Unclear naming, no docs, too long
export function process(arr) {
    // 50 lines of mixed logic...
}
```

### File Organization

```javascript
/**
 * Module Name
 * 
 * Brief description of what this module does.
 * 
 * @module moduleName
 */

import dependencies from '...';

// -----------------------------------------------------------------------------
// Constants (if any)
// -----------------------------------------------------------------------------

const MY_CONSTANT = 'value';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function publicFunction() { }

// -----------------------------------------------------------------------------
// Private Helpers
// -----------------------------------------------------------------------------

function privateHelper() { }
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | camelCase.js | `scannerUtils.js` |
| Functions | camelCase | `formatViolation()` |
| Constants | UPPER_SNAKE | `CONFIG_FILE_NAME` |
| Classes | PascalCase | `ViolationFormatter` |

---

## Commit Guidelines

We use [Conventional Commits](https://www.conventionalcommits.org/) format.

### Format

```
<type>: <short description>

[optional body]

[optional footer]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no code change |
| `refactor` | Code change, no new feature or fix |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Maintenance, dependencies |

### Examples

```bash
# Feature
feat: add --json-file option for direct file export

# Bug fix
fix: normalize path separators for Windows compatibility

# Documentation
docs: update README with CI/CD examples

# Refactor
refactor: extract violation formatting to shared utility
```

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Self-reviewed your own code
- [ ] Added JSDoc comments for new functions
- [ ] Tested locally with both quick and full scans
- [ ] Updated documentation if needed
- [ ] Commits follow conventional format

### PR Title Format

Same as commit format:

```
feat: add support for SARIF output format
fix: handle multi-line HTML elements in source mapping
```

### PR Description Template

```markdown
## Description
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation
- [ ] Refactor

## Testing Done
- [ ] Tested quick scan
- [ ] Tested full scan
- [ ] Tested on Windows
- [ ] Tested on Mac/Linux

## Related Issues
Fixes #123
```

---

## Testing

### Manual Testing

Create test HTML files in `test-files/`:

```html
<!-- test-files/button-test.html -->
<!DOCTYPE html>
<html lang="en">
<head><title>Test</title></head>
<body>
    <!-- This should trigger button-name violation -->
    <button></button>
</body>
</html>
```

Run scans:

```bash
# Quick scan
allycat scan ./test-files

# Full scan
allycat scan ./test-files --full

# Specific file
allycat scan ./test-files/button-test.html
```

### Test Different Scenarios

| Scenario | Command |
|----------|---------|
| No violations | Create valid HTML, expect clean output |
| Multiple violations | Create HTML with issues, verify all found |
| Contrast issues | Use --full to detect contrast problems |
| RTL compliance | Set Israeli standard, check dir="rtl" |
| JSON output | `--json-file` and `-o json` |
| Summary mode | `--summary` flag |

---

## Reporting Bugs

### Before Reporting

1. Check existing issues for duplicates
2. Try latest version: `npm update -g allycat`
3. Gather system info

### Bug Report Template

```markdown
**Describe the bug**
Clear description of what happened.

**To Reproduce**
1. Run `allycat init`
2. Run `allycat scan ./src`
3. See error

**Expected behavior**
What you expected to happen.

**Environment**
- OS: [e.g., Windows 11, macOS 14, Ubuntu 22]
- Node.js: [e.g., 20.11.0]
- AllyCat: [e.g., 1.0.0]

**Config file**
```json
{
  "framework": "...",
  ...
}
```

**Additional context**
Screenshots, error messages, etc.
```

---

## Suggesting Features

### Feature Request Template

```markdown
**Is this related to a problem?**
Description of the problem or use case.

**Describe the solution**
What you'd like to happen.

**Describe alternatives**
Other solutions you've considered.

**Additional context**
Mockups, examples, references.
```

### Good Feature Requests

- Solve a real problem
- Align with project goals
- Consider implementation complexity
- Include use cases

---

## Questions?

- Open a [GitHub Discussion](https://github.com/YOUR_USERNAME/allycat/discussions)
- Check existing issues
- Review the code and comments

---

Thank you for contributing! 🎉
