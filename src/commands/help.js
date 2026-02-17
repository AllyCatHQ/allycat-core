/**
 * Help Command
 * 
 * Provides detailed help, FAQ, examples, and guides.
 * 
 * @module commands/help
 */

import chalk from 'chalk';

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/**
 * Main help command entry point
 * 
 * @param {string|undefined} topic - Help topic (faq, examples, ci, standards)
 */
export function helpCommand(topic) {
    console.log('');

    switch (topic?.toLowerCase()) {
        case 'faq':
            showFaq();
            break;
        case 'examples':
            showExamples();
            break;
        case 'ci':
            showCiGuide();
            break;
        case 'standards':
            showStandards();
            break;
        default:
            showTopicList();
    }
}

// -----------------------------------------------------------------------------
// Topic: FAQ
// -----------------------------------------------------------------------------

function showFaq() {
    const title = chalk.bold.cyan('Frequently Asked Questions');
    const divider = chalk.dim('─'.repeat(60));

    console.log(title);
    console.log(divider);
    console.log('');

    const faqs = [
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

    faqs.forEach((faq, index) => {
        console.log(chalk.bold.white(`Q${index + 1}: ${faq.q}`));
        console.log(chalk.dim(`A: `) + faq.a);
        console.log('');
    });

    console.log(divider);
    console.log(chalk.dim('More help: a11y-guard help examples'));
    console.log('');
}

// -----------------------------------------------------------------------------
// Topic: Examples
// -----------------------------------------------------------------------------

function showExamples() {
    const title = chalk.bold.cyan('Usage Examples');
    const divider = chalk.dim('─'.repeat(60));

    console.log(title);
    console.log(divider);
    console.log('');

    const sections = [
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

    sections.forEach(section => {
        console.log(chalk.bold.yellow(section.title));
        section.examples.forEach(ex => {
            console.log(`  ${chalk.cyan('$')} ${chalk.white(ex.cmd)}`);
            console.log(`    ${chalk.dim(ex.desc)}`);
        });
        console.log('');
    });

    console.log(divider);
    console.log(chalk.dim('More help: a11y-guard help ci'));
    console.log('');
}

// -----------------------------------------------------------------------------
// Topic: CI/CD Guide
// -----------------------------------------------------------------------------

function showCiGuide() {
    const title = chalk.bold.cyan('CI/CD Integration Guide');
    const divider = chalk.dim('─'.repeat(60));

    console.log(title);
    console.log(divider);
    console.log('');

    console.log(chalk.bold.yellow('GitHub Actions'));
    console.log('');
    console.log(chalk.dim(`  Create ${chalk.white('.github/workflows/accessibility.yml')}:`));
    console.log('');
    console.log(chalk.gray(`  name: Accessibility Check

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
          run: a11y-guard scan --json-file a11y-report
        
        - name: Upload report
          uses: actions/upload-artifact@v4
          with:
            name: accessibility-report
            path: a11y-report.json`));
    console.log('');

    console.log(chalk.bold.yellow('GitLab CI'));
    console.log('');
    console.log(chalk.gray(`  accessibility:
    image: node:20
    script:
      - npm ci
      - npm install -g a11y-guard
      - a11y-guard scan --json-file a11y-report
    artifacts:
      paths:
        - a11y-report.json`));
    console.log('');

    console.log(chalk.bold.yellow('Jenkins'));
    console.log('');
    console.log(chalk.gray(`  stage('Accessibility') {
      steps {
        sh 'npm install -g a11y-guard'
        sh 'a11y-guard scan --json-file a11y-report'
        archiveArtifacts artifacts: 'a11y-report.json'
      }
    }`));
    console.log('');

    console.log(divider);
    console.log(chalk.dim('More help: a11y-guard help examples'));
    console.log('');
}

// -----------------------------------------------------------------------------
// Topic: Standards
// -----------------------------------------------------------------------------

function showStandards() {
    const title = chalk.bold.cyan('Accessibility Standards');
    const divider = chalk.dim('─'.repeat(60));

    console.log(title);
    console.log(divider);
    console.log('');

    console.log(chalk.bold.yellow('WCAG 2.1 Level AA') + chalk.dim(' (Recommended)'));
    console.log(`  The industry standard for web accessibility.
  Required for most compliance needs.
  
  ${chalk.dim('Includes:')}
  • Text alternatives for images
  • Keyboard navigation
  • Color contrast (4.5:1 for normal text)
  • Form labels and error handling
  • Consistent navigation
`);

    console.log(chalk.bold.yellow('WCAG 2.1 Level AAA') + chalk.dim(' (Strictest)'));
    console.log(`  The highest level of accessibility compliance.
  Often required for government/medical sites.
  
  ${chalk.dim('Adds:')}
  • Enhanced contrast (7:1 for normal text)
  • Sign language for audio
  • Extended audio descriptions
  • No timing limits
`);

    console.log(chalk.bold.yellow('Israeli Standard IS 5568') + chalk.dim(' (Israel)'));
    console.log(`  Based on WCAG 2.1 AA with additional requirements.
  Mandatory for Israeli websites by law.
  
  ${chalk.dim('Adds:')}
  • RTL (right-to-left) support required
  • Hebrew language accessibility
  • dir="rtl" attribute on <html>
`);

    console.log(chalk.bold.white('Comparison Table'));
    console.log('');
    console.log(chalk.dim('  Standard     │ Contrast │ RTL Required │ Use Case'));
    console.log(chalk.dim('  ────────────────────────────────────────────────────────'));
    console.log(chalk.dim('  WCAG AA      │ 4.5:1    │ No           │ Most websites'));
    console.log(chalk.dim('  WCAG AAA     │ 7:1      │ No           │ Government/Medical'));
    console.log(chalk.dim('  Israeli 5568 │ 4.5:1    │ Yes          │ Israeli websites'));
    console.log('');

    console.log(divider);
    console.log(chalk.dim('Set your standard: a11y-guard init'));
    console.log('');
}

// -----------------------------------------------------------------------------
// Topic List (Default)
// -----------------------------------------------------------------------------

function showTopicList() {
    const title = chalk.bold.cyan('A11y-Guard Help');
    const divider = chalk.dim('─'.repeat(60));

    console.log(title);
    console.log(divider);
    console.log('');

    console.log(chalk.bold('Available Help Topics:'));
    console.log('');
    console.log(`  ${chalk.cyan('a11y-guard help faq')}       ${chalk.dim('Common questions and answers')}`);
    console.log(`  ${chalk.cyan('a11y-guard help examples')}  ${chalk.dim('Real-world usage examples')}`);
    console.log(`  ${chalk.cyan('a11y-guard help ci')}        ${chalk.dim('CI/CD integration guide')}`);
    console.log(`  ${chalk.cyan('a11y-guard help standards')} ${chalk.dim('Accessibility standards explained')}`);
    console.log('');

    console.log(chalk.bold('Command Help:'));
    console.log('');
    console.log(`  ${chalk.cyan('a11y-guard --help')}         ${chalk.dim('Overview of all commands')}`);
    console.log(`  ${chalk.cyan('a11y-guard init --help')}    ${chalk.dim('Init command options')}`);
    console.log(`  ${chalk.cyan('a11y-guard scan --help')}    ${chalk.dim('Scan command options')}`);
    console.log('');

    console.log(divider);
    console.log(chalk.dim('Quick start: a11y-guard init && a11y-guard scan'));
    console.log('');
}
