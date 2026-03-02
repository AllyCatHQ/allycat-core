/**
 * Help Content
 *
 * All static content data for the help command:
 * FAQ items, usage examples, and CI/CD code snippets.
 *
 * @module commands/helpContent
 */

import chalk from 'chalk';
import { INSTALL, CLI, CONFIG_FILE_NAME, DEFAULT_REPORT_NAME, SUPPORTED_EXTENSIONS_DISPLAY } from '../constants.js';

// -----------------------------------------------------------------------------
// FAQ
// -----------------------------------------------------------------------------

export const FAQ_ITEMS = [
    {
        q: 'Why is contrast checking not working?',
        a: `Contrast checking requires a real browser engine.
   Use ${chalk.cyan('--full')} mode: ${chalk.yellow(`${CLI.SCAN} --full`)}
   This uses Playwright with Chromium for accurate contrast detection.`
    },
    {
        q: 'How do I install Playwright for full scans?',
        a: `Run these commands:
   ${chalk.yellow(INSTALL.PLAYWRIGHT)}
   ${chalk.yellow(INSTALL.CHROMIUM)}`
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
        a: `Run ${chalk.cyan(CLI.INIT)} first to create the config file.
   This creates ${chalk.yellow(CONFIG_FILE_NAME)} in your project root.`
    },
    {
        q: 'Can I use both forward slashes and backslashes in paths?',
        a: `Yes! Both work on all platforms:
   ${chalk.yellow(`${CLI.SCAN} ./src`)}
   ${chalk.yellow(`${CLI.SCAN} .\\src`)}`
    },
    {
        q: 'How do I block a CI pipeline on accessibility failures?',
        a: `Choose a threshold flag — each uses a distinct exit code:

   ${chalk.cyan('--fail-on-critical')}  ${chalk.dim('# critical violations only (loosest gate)')}
   ${chalk.cyan('--fail-on-serious')}   ${chalk.dim('# serious or critical')}
   ${chalk.cyan('--fail-on-any')}       ${chalk.dim('# any violation (strictest gate)')}

   Exit codes:
   ${chalk.green('0')} — threshold not met        → pipeline continues
   ${chalk.red('1')} — critical violations found  → --fail-on-critical triggered
   ${chalk.red('2')} — serious violations found   → --fail-on-serious triggered
   ${chalk.red('3')} — any violations found       → --fail-on-any triggered

   Combine with ${chalk.cyan('--json-file')} to block ${chalk.bold('and')} save a report:
   ${chalk.yellow(`${CLI.SCAN} --fail-on-serious --json-file ${DEFAULT_REPORT_NAME}`)}`
    },
    {
        q: 'How do I save the report to a file?',
        a: `Two options:

   ${chalk.bold('Option 1:')} Use --json-file (recommended)
   ${chalk.yellow(`${CLI.SCAN} --json-file`)}         ${chalk.dim('# Auto-timestamped')}
   ${chalk.yellow(`${CLI.SCAN} --json-file report`)}  ${chalk.dim('# Custom name')}

   ${chalk.bold('Option 2:')} Shell redirection
   ${chalk.yellow(`${CLI.SCAN} -o json > report.json`)}`
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
   1. File has a supported extension:
      ${chalk.yellow('.html')}, ${chalk.yellow('.htm')}, ${chalk.yellow('.jsx')}, ${chalk.yellow('.tsx')}, ${chalk.yellow('.vue')},
      ${chalk.yellow('.component.html')}, ${chalk.yellow('.component.ts')} (Angular)
   2. File is not inside ${chalk.yellow('node_modules/')}, ${chalk.yellow('dist/')}, or ${chalk.yellow('build/')}`
    },
    {
        q: 'How do I scan only the files I changed in git?',
        a: `Use ${chalk.cyan('--changed')} to scope the scan to uncommitted git changes:
   ${chalk.yellow(`${CLI.SCAN} --changed`)}           ${chalk.dim('# All changed files')}
   ${chalk.yellow(`${CLI.SCAN} --changed ./src`)}     ${chalk.dim('# Changed files under ./src')}

   Requires git. Falls back to a full project scan if no changed files are found.
   Best used in pre-commit hooks or fast feedback loops.`
    },
    {
        q: 'How does watch mode work?',
        a: `Use ${chalk.cyan('--watch')} to automatically re-scan files whenever they are saved:
   ${chalk.yellow(`${CLI.SCAN} --watch`)}             ${chalk.dim('# Watch entire project')}
   ${chalk.yellow(`${CLI.SCAN} --watch ./src`)}       ${chalk.dim('# Watch specific folder')}
   ${chalk.yellow(`${CLI.SCAN} --watch --summary`)}   ${chalk.dim('# Counts only — no descriptions')}

   Supports all file types: ${SUPPORTED_EXTENSIONS_DISPLAY}
   Shows only the delta (NEW / FIXED) after each save — not the full output.
   Press ${chalk.bold('Ctrl+C')} to stop.`
    }
];

// -----------------------------------------------------------------------------
// Examples
// -----------------------------------------------------------------------------

export const EXAMPLE_SECTIONS = [
    {
        title: 'Basic Scanning',
        examples: [
            { cmd: CLI.SCAN,                     desc: 'Scan entire project' },
            { cmd: `${CLI.SCAN} ./src`,           desc: 'Scan specific folder' },
            { cmd: `${CLI.SCAN} ./src/App.tsx`,   desc: 'Scan specific file' },
            { cmd: `${CLI.SCAN} ./src ./public`,  desc: 'Scan multiple paths' }
        ]
    },
    {
        title: 'Scan Modes',
        examples: [
            { cmd: `${CLI.SCAN} --quick`, desc: 'Fast scan, no contrast (default)' },
            { cmd: `${CLI.SCAN} --full`,  desc: 'Full scan with contrast checking' },
            { cmd: `${CLI.SCAN} -f`,      desc: 'Short form of --full' }
        ]
    },
    {
        title: 'Output Formats',
        examples: [
            { cmd: CLI.SCAN,                          desc: 'Terminal output (default)' },
            { cmd: `${CLI.SCAN} --summary`,           desc: 'Summary counts only' },
            { cmd: `${CLI.SCAN} -o json`,             desc: 'JSON to terminal' },
            { cmd: `${CLI.SCAN} --json-file`,         desc: 'Save to auto-named file' },
            { cmd: `${CLI.SCAN} --json-file report`,  desc: 'Save to report.json' }
        ]
    },
    {
        title: 'CI/CD Integration',
        examples: [
            { cmd: `${CLI.SCAN} --fail-on-critical`,              desc: 'Block on critical violations only (exit 1)' },
            { cmd: `${CLI.SCAN} --fail-on-serious`,               desc: 'Block on serious or critical violations' },
            { cmd: `${CLI.SCAN} --fail-on-any`,                   desc: 'Block on any violation (strictest gate)' },
            { cmd: `${CLI.SCAN} --json-file ci-report`,           desc: 'Generate report artifact' },
            { cmd: `${CLI.SCAN} -o json > report.json`,           desc: 'Redirect to file' }
        ]
    },
    {
        title: 'Incremental Scanning',
        examples: [
            { cmd: `${CLI.SCAN} --changed`,           desc: 'Scan only git-changed files' },
            { cmd: `${CLI.SCAN} --changed ./src`,     desc: 'Changed files scoped to ./src' },
            { cmd: `${CLI.SCAN} --watch`,             desc: 'Watch and re-scan on save (delta output)' },
            { cmd: `${CLI.SCAN} --watch ./src`,       desc: 'Watch specific folder' },
            { cmd: `${CLI.SCAN} --watch --summary`,   desc: 'Watch with counts only — no descriptions' }
        ]
    },
    {
        title: 'Combined Options',
        examples: [
            { cmd: `${CLI.SCAN} ./src --full --summary`, desc: 'Full scan, summary only' },
            { cmd: `${CLI.SCAN} ./src -f --json-file`,   desc: 'Full scan to JSON file' },
            { cmd: `${CLI.SCAN} ./src -q -s`,            desc: 'Quick scan, summary (fastest)' }
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
