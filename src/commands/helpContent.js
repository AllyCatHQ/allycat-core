/**
 * Help Content
 *
 * All static content data for the help command:
 * FAQ items, usage examples, and CI/CD code snippets.
 *
 * @module commands/helpContent
 */

import chalk from 'chalk';
import { INSTALL, CLI, CONFIG_FILE_NAME, DEFAULT_REPORT_NAME, SUPPORTED_EXTENSIONS, SUPPORTED_EXTENSIONS_DISPLAY, SUPPORTED_FRAMEWORKS } from '../constants.js';

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
        a: `Run the install command for your setup, then download the browser:

   Global install:  ${chalk.yellow(INSTALL.PLAYWRIGHT_GLOBAL)}
   Local project:   ${chalk.yellow(INSTALL.PLAYWRIGHT_LOCAL)}

   Then download the browser:
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
        q: 'What does "Auto → X files" mean in the scan panel?',
        a: `The scanner runs files in parallel. ${chalk.bold('Auto')} means the limit is calculated
   from your machine's available RAM and CPU — no manual tuning needed.

   Formula (quick mode):  min(60% RAM ÷ 200 MB, CPU cores × 4)
   Formula (full mode):   min(60% RAM ÷ 500 MB, CPU cores × 4, 8)

   The number after "→" is the resolved limit for this run.
   To override it, run ${chalk.cyan(CLI.INIT)} and enable ${chalk.bold('advanced options')}.`
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
   ${chalk.cyan('--fail-on-new')}       ${chalk.dim('# only violations not in the saved baseline (exit 4)')}

   Exit codes:
   ${chalk.green('0')} — threshold not met        → pipeline continues
   ${chalk.red('1')} — critical violations found  → --fail-on-critical triggered
   ${chalk.red('2')} — serious violations found   → --fail-on-serious triggered
   ${chalk.red('3')} — any violations found       → --fail-on-any triggered
   ${chalk.red('4')} — new violations vs baseline → --fail-on-new triggered

   Combine with ${chalk.cyan('--json-file')} to block ${chalk.bold('and')} save a report:
   ${chalk.yellow(`${CLI.SCAN} --fail-on-serious --json-file ${DEFAULT_REPORT_NAME}`)}`
    },
    {
        q: 'How do I adopt a CI a11y gate without fixing all existing violations first?',
        a: `Use the baseline workflow — snapshot existing violations and only fail on ${chalk.bold('new')} ones:

   ${chalk.bold('Step 1:')} Snapshot all current violations (run once, commit the file)
   ${chalk.yellow(`${CLI.SCAN} --save-baseline`)}
   → Creates ${chalk.cyan('allycat-baseline.json')} in your project root

   ${chalk.bold('Step 2:')} In CI — only fail on NEW violations
   ${chalk.yellow(`${CLI.SCAN} --fail-on-new`)}
   → ${chalk.green('Exit 0')} if all violations were in the baseline
   → ${chalk.red('Exit 4')} if any violation is NOT in the baseline

   ${chalk.bold('Step 3:')} After fixing violations, update the baseline
   ${chalk.yellow(`${CLI.SCAN} --save-baseline`)}
   → Re-run to remove fixed violations from the snapshot

   ${chalk.bold('Combine with severity gates:')}
   ${chalk.yellow(`${CLI.SCAN} --fail-on-new --fail-on-critical`)}
   → Blocks on new violations (exit 4) ${chalk.dim('or')} critical baseline violations (exit 1)

   ${chalk.bold('If no baseline file is found:')}
   --fail-on-new emits a warning and exits 0 (safe first-run default)`
    },
    {
        q: 'How do I reduce output noise in CI logs?',
        a: `Use ${chalk.cyan('--ci')} to activate a CI-friendly preset in one flag:
   ${chalk.yellow(`${CLI.SCAN} --ci`)}

   This enables all of the following at once:
   ${chalk.cyan('--no-snippet')}          ${chalk.dim('# hide HTML snippet per violation')}
   ${chalk.cyan('--no-help')}             ${chalk.dim('# hide help text per violation')}
   ${chalk.cyan('--no-wcag')}             ${chalk.dim('# hide WCAG tags per violation')}
   ${chalk.cyan('--no-selector')}         ${chalk.dim('# hide element selector per violation')}
   ${chalk.cyan('--no-affected')}         ${chalk.dim('# hide affected element count per violation')}
   ${chalk.cyan('--summary-style compact')} ${chalk.dim('# single-line summary instead of box')}
   ${chalk.cyan('--fail-on-critical')}    ${chalk.dim('# exit 1 if any critical violations found')}

   Or apply flags individually for partial suppression:
   ${chalk.yellow(`${CLI.SCAN} --no-snippet --no-wcag`)}    ${chalk.dim('# hide snippets and WCAG tags only')}
   ${chalk.yellow(`${CLI.SCAN} --summary-style compact`)}   ${chalk.dim('# single-line summary only')}`
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
   • ${chalk.cyan('WCAG 2.2 AA')} — Industry frontier; adds target size check (SC 2.5.8)
   • ${chalk.cyan('WCAG AAA (automated rules)')} — Maximum automation; full AAA requires a manual audit
   • RTL support ${chalk.dim('(experimental)')} — Enable during ${chalk.cyan('allycat init')} for Hebrew, Arabic, Persian interfaces`
    },
    {
        q: 'Does AllyCat support Vue and Angular?',
        a: `Yes! The scanner automatically detects and handles all major frameworks:
${SUPPORTED_FRAMEWORKS.map(f => `   • ${f.extensions.map(e => chalk.cyan(e)).join(', ')} — ${chalk.bold(f.label)}`).join('\n')}

   No extra configuration needed — just run ${chalk.yellow(CLI.SCAN)} in your project.`
    },
    {
        q: 'Why are some files not being scanned?',
        a: `Check these:
   1. File has a supported extension:
      ${SUPPORTED_EXTENSIONS.map(e => chalk.yellow(`.${e}`)).join(', ')}
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
   ${chalk.yellow(`${CLI.SCAN} --watch`)}              ${chalk.dim('# Watch entire project (pre-existing shown as counts)')}
   ${chalk.yellow(`${CLI.SCAN} --watch ./src`)}        ${chalk.dim('# Watch specific folder')}
   ${chalk.yellow(`${CLI.SCAN} --watch --existing`)}   ${chalk.dim('# Show full details of pre-existing violations on startup')}
   ${chalk.yellow(`${CLI.SCAN} --watch --summary`)}    ${chalk.dim('# Counts only — no descriptions for delta output')}

   Supports all file types: ${SUPPORTED_EXTENSIONS_DISPLAY}
   Press ${chalk.bold('Ctrl+C')} to stop.

   After each save, watch mode shows a ${chalk.bold('delta')} — only what changed:
   ${chalk.green('[NEW]')}   — violation appeared since the last scan
   ${chalk.red('[FIXED]')} — violation was present before and is now resolved
   No label  — violation is unchanged since the last scan`
    },
    {
        q: 'How do I exclude a folder or file from the scan?',
        a: `Use ${chalk.cyan('--exclude')} — repeatable, accepts paths and glob patterns:
   ${chalk.yellow(`${CLI.SCAN} --exclude tests`)}
   ${chalk.yellow(`${CLI.SCAN} --exclude tests --exclude src/generated`)}
   ${chalk.yellow(`${CLI.SCAN} --exclude "**/*.stories.*"`)}
   ${chalk.yellow(`${CLI.SCAN} scripts --exclude test.html`)}        ${chalk.dim('→ scripts/test.html')}
   ${chalk.yellow(`${CLI.SCAN} src/components --exclude fixtures`)}  ${chalk.dim('→ src/components/fixtures (entire folder)')}
   ${chalk.yellow(`${CLI.SCAN} src/test --exclude __mocks__`)}       ${chalk.dim('→ src/test/__mocks__')}

   Stacks on top of the built-in ignores (node_modules, dist, build).
   Works in both normal scan and watch mode.
   When scanning a scoped path, --exclude names are automatically resolved relative to that target — no need to type the full path.`
    }
];

// -----------------------------------------------------------------------------
// Examples
// -----------------------------------------------------------------------------

export const EXAMPLE_SECTIONS = [
    {
        title: 'Basic Scanning',
        examples: [
            { cmd: CLI.SCAN,                                        desc: 'Scan entire project' },
            { cmd: `${CLI.SCAN} ./src`,                             desc: 'Scan specific folder' },
            { cmd: `${CLI.SCAN} ./src/App.tsx`,                     desc: 'Scan a React/TSX file' },
            { cmd: `${CLI.SCAN} ./src/App.vue`,                     desc: 'Scan a Vue component' },
            { cmd: `${CLI.SCAN} ./src/app.component.html`,          desc: 'Scan an Angular template' }
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
            { cmd: `${CLI.SCAN} --ci`,                            desc: 'CI preset — compact output + fail on critical' },
            { cmd: `${CLI.SCAN} --ci --fail-on-any`,              desc: 'CI preset with strictest gate' },
            { cmd: `${CLI.SCAN} --fail-on-critical`,              desc: 'Block on critical violations only (exit 1)' },
            { cmd: `${CLI.SCAN} --fail-on-serious`,               desc: 'Block on serious or critical violations' },
            { cmd: `${CLI.SCAN} --fail-on-any`,                   desc: 'Block on any violation (strictest gate)' },
            { cmd: `${CLI.SCAN} --no-snippet --no-wcag`,          desc: 'Hide snippets and WCAG tags only' },
            { cmd: `${CLI.SCAN} --summary-style compact`,         desc: 'Single-line summary' },
            { cmd: `${CLI.SCAN} --json-file ci-report`,           desc: 'Generate report artifact' },
            { cmd: `${CLI.SCAN} -o json > report.json`,           desc: 'Redirect to file' }
        ]
    },
    {
        title: 'Baseline Workflow',
        examples: [
            { cmd: `${CLI.SCAN} --save-baseline`,                              desc: 'Snapshot all current violations to allycat-baseline.json' },
            { cmd: `${CLI.SCAN} --fail-on-new`,                                desc: 'Exit 4 if any violation is not in the baseline' },
            { cmd: `${CLI.SCAN} --fail-on-new --fail-on-critical`,             desc: 'Combine baseline gate with severity gate' },
            { cmd: `${CLI.SCAN} ./src --save-baseline`,                        desc: 'Save baseline scoped to ./src' }
        ]
    },
    {
        title: 'Incremental Scanning',
        examples: [
            { cmd: `${CLI.SCAN} --changed`,           desc: 'Scan only git-changed files' },
            { cmd: `${CLI.SCAN} --changed ./src`,     desc: 'Changed files scoped to ./src' },
            { cmd: `${CLI.SCAN} --watch`,              desc: 'Watch and re-scan on save (pre-existing shown as counts)' },
            { cmd: `${CLI.SCAN} --watch ./src`,        desc: 'Watch specific folder' },
            { cmd: `${CLI.SCAN} --watch --existing`,   desc: 'Watch — show full details of pre-existing violations on startup' },
            { cmd: `${CLI.SCAN} --watch --summary`,    desc: 'Watch with counts only — no descriptions for delta output' }
        ]
    },
    {
        title: 'Path Filtering',
        examples: [
            { cmd: `${CLI.SCAN} --exclude tests`,                         desc: 'Skip the tests folder' },
            { cmd: `${CLI.SCAN} --exclude tests --exclude src/generated`,  desc: 'Skip multiple paths' },
            { cmd: `${CLI.SCAN} --exclude "**/*.stories.*"`,               desc: 'Skip all Storybook stories (glob)' },
            { cmd: `${CLI.SCAN} scripts --exclude test.html`,              desc: 'Scan scripts/ — auto-resolves to scripts/test.html' },
            { cmd: `${CLI.SCAN} src/components --exclude fixtures`,        desc: 'Scan src/components — auto-resolves to src/components/fixtures' },
            { cmd: `${CLI.SCAN} src/test --exclude __mocks__`,             desc: 'Scan src/test — auto-resolves to src/test/__mocks__' }
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

        - name: Install AllyCat
          run: npm install -g allycat

        - name: Run accessibility scan
          run: allycat scan --ci --json-file allycat-report

        - name: Upload report
          if: always()
          uses: actions/upload-artifact@v4
          with:
            name: accessibility-report
            path: allycat-report.json`;

export const GITLAB_CI_SNIPPET =
`  accessibility:
    image: node:20
    script:
      - npm ci
      - npm install -g allycat
      - allycat scan --ci --json-file allycat-report
    artifacts:
      paths:
        - allycat-report.json`;

export const JENKINS_SNIPPET =
`  stage('Accessibility') {
      steps {
        sh 'npm install -g allycat'
        sh 'allycat scan --ci --json-file allycat-report'
        archiveArtifacts artifacts: 'allycat-report.json'
      }
    }`;
