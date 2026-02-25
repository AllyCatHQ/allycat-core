/**
 * Help Content
 *
 * All static content data for the help command:
 * FAQ items, usage examples, and CI/CD code snippets.
 *
 * @module commands/helpContent
 */

import chalk from 'chalk';

// -----------------------------------------------------------------------------
// FAQ
// -----------------------------------------------------------------------------

export const FAQ_ITEMS = [
    {
        q: 'Why is contrast checking not working?',
        a: `Contrast checking requires a real browser engine.
   Use ${chalk.cyan('--full')} mode: ${chalk.yellow('a11y-guard scan --full')}
   This uses Playwright with Chromium for accurate contrast detection.`
    },
    {
        q: 'How do I install Playwright for full scans?',
        a: `Run these commands:
   ${chalk.yellow('npm install playwright @axe-core/playwright')}
   ${chalk.yellow('npx playwright install chromium')}`
    },
    {
        q: 'What\'s the difference between quick and full scan?',
        a: `${chalk.yellow('Quick scan')} (default):
   • Uses JSDOM — fast (~1s per file)
   • Skips contrast checking
   • Best for development

   ${chalk.green('Full scan')} (--full):
   • Uses Playwright + Chromium
   • Includes contrast checking
   • Best for CI/CD and final checks`
    },
    {
        q: 'Why do I see "No configuration found"?',
        a: `Run ${chalk.cyan('a11y-guard init')} first to create the config file.
   This creates ${chalk.yellow('a11y-config.json')} in your project root.`
    },
    {
        q: 'Can I use both forward slashes and backslashes in paths?',
        a: `Yes! Both work on all platforms:
   ${chalk.yellow('a11y-guard scan ./src')}
   ${chalk.yellow('a11y-guard scan .\\src')}`
    },
    {
        q: 'How do I block a CI pipeline on accessibility failures?',
        a: `Use ${chalk.cyan('--fail-on-critical')} to exit with code 1 when critical violations are found:
   ${chalk.yellow('a11y-guard scan --fail-on-critical')}

   Exit codes:
   ${chalk.green('0')} — clean scan, or only non-critical violations → pipeline continues
   ${chalk.red('1')} — critical violations found → pipeline blocks

   Combine with ${chalk.cyan('--json-file')} to block ${chalk.bold('and')} save a report:
   ${chalk.yellow('a11y-guard scan --fail-on-critical --json-file a11y-report')}`
    },
    {
        q: 'How do I save the report to a file?',
        a: `Two options:

   ${chalk.bold('Option 1:')} Use --json-file (recommended)
   ${chalk.yellow('a11y-guard scan --json-file')}         ${chalk.dim('# Auto-timestamped')}
   ${chalk.yellow('a11y-guard scan --json-file report')}  ${chalk.dim('# Custom name')}

   ${chalk.bold('Option 2:')} Shell redirection
   ${chalk.yellow('a11y-guard scan -o json > report.json')}`
    },
    {
        q: 'What accessibility standards are supported?',
        a: `• ${chalk.cyan('WCAG 2.1 AA')} — Industry standard (default)
   • ${chalk.cyan('WCAG 2.1 AAA')} — Strictest level
   • ${chalk.cyan('Israeli IS 5568')} — Israel accessibility law (includes RTL)`
    },
    {
        q: 'Why are some files not being scanned?',
        a: `Check these:
   1. File extension matches your framework config
   2. Files are not in ${chalk.yellow('node_modules/')}, ${chalk.yellow('dist/')}, or ${chalk.yellow('build/')}
   3. Framework is set correctly in ${chalk.yellow('a11y-config.json')}`
    }
];

// -----------------------------------------------------------------------------
// Examples
// -----------------------------------------------------------------------------

export const EXAMPLE_SECTIONS = [
    {
        title: 'Basic Scanning',
        examples: [
            { cmd: 'a11y-guard scan', desc: 'Scan entire project' },
            { cmd: 'a11y-guard scan ./src', desc: 'Scan specific folder' },
            { cmd: 'a11y-guard scan ./src/App.tsx', desc: 'Scan specific file' },
            { cmd: 'a11y-guard scan ./src ./public', desc: 'Scan multiple paths' }
        ]
    },
    {
        title: 'Scan Modes',
        examples: [
            { cmd: 'a11y-guard scan --quick', desc: 'Fast scan, no contrast (default)' },
            { cmd: 'a11y-guard scan --full', desc: 'Full scan with contrast checking' },
            { cmd: 'a11y-guard scan -f', desc: 'Short form of --full' }
        ]
    },
    {
        title: 'Output Formats',
        examples: [
            { cmd: 'a11y-guard scan', desc: 'Terminal output (default)' },
            { cmd: 'a11y-guard scan --summary', desc: 'Summary counts only' },
            { cmd: 'a11y-guard scan -o json', desc: 'JSON to terminal' },
            { cmd: 'a11y-guard scan --json-file', desc: 'Save to auto-named file' },
            { cmd: 'a11y-guard scan --json-file report', desc: 'Save to report.json' }
        ]
    },
    {
        title: 'CI/CD Integration',
        examples: [
            { cmd: 'a11y-guard scan --fail-on-critical', desc: 'Block pipeline on critical violations (exit 1)' },
            { cmd: 'a11y-guard scan --full --fail-on-critical', desc: 'Full scan — block on critical' },
            { cmd: 'a11y-guard scan --json-file ci-report', desc: 'Generate report artifact' },
            { cmd: 'a11y-guard scan -o json > report.json', desc: 'Redirect to file' },
            { cmd: 'a11y-guard scan --summary --full', desc: 'Quick CI check with contrast' }
        ]
    },
    {
        title: 'Combined Options',
        examples: [
            { cmd: 'a11y-guard scan ./src --full --summary', desc: 'Full scan, summary only' },
            { cmd: 'a11y-guard scan ./src -f --json-file', desc: 'Full scan to JSON file' },
            { cmd: 'a11y-guard scan ./src -q -s', desc: 'Quick scan, summary (fastest)' }
        ]
    }
];

// -----------------------------------------------------------------------------
// CI/CD Code Snippets
// -----------------------------------------------------------------------------

export const GITHUB_ACTIONS_SNIPPET =
`  name: Accessibility Check

  on: [push, pull_request]

  jobs:
    a11y:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4

        - name: Setup Node.js
          uses: actions/setup-node@v4
          with:
            node-version: '20'

        - name: Install dependencies
          run: npm ci

        - name: Install A11y-Guard
          run: npm install -g a11y-guard

        - name: Run accessibility scan
          run: a11y-guard scan --fail-on-critical --json-file a11y-report

        - name: Upload report
          uses: actions/upload-artifact@v4
          with:
            name: accessibility-report
            path: a11y-report.json`;

export const GITLAB_CI_SNIPPET =
`  accessibility:
    image: node:20
    script:
      - npm ci
      - npm install -g a11y-guard
      - a11y-guard scan --fail-on-critical --json-file a11y-report
    artifacts:
      paths:
        - a11y-report.json`;

export const JENKINS_SNIPPET =
`  stage('Accessibility') {
      steps {
        sh 'npm install -g a11y-guard'
        sh 'a11y-guard scan --fail-on-critical --json-file a11y-report'
        archiveArtifacts artifacts: 'a11y-report.json'
      }
    }`;
