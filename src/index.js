#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { scanCommand } from './commands/scan.js';
import { helpCommand } from './commands/help.js';
import { UI, APP_LINKS } from './constants.js';

const program = new Command();

// Program Configuration

program
  .name('a11y-guard')
  .description(`
${chalk.bold('A11y-Guard')} — Professional CLI for accessibility compliance testing.

Supports ${chalk.cyan('WCAG 2.1 AA/AAA')} and ${chalk.cyan('Israeli Standard IS 5568')}.
Fast scanning with precise error locations and clickable VS Code links.
    `.trim())
  .version('1.0.0', '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help information')
  .addHelpText('after', `
${chalk.dim(UI.DIVIDER)}

${chalk.bold('Quick Start:')}
  ${chalk.cyan('$')} a11y-guard init          ${chalk.dim('# Setup configuration')}
  ${chalk.cyan('$')} a11y-guard scan          ${chalk.dim('# Scan your project')}

${chalk.bold('Learn More:')}
  ${chalk.cyan('$')} a11y-guard help examples ${chalk.dim('# See usage examples')}
  ${chalk.cyan('$')} a11y-guard help faq      ${chalk.dim('# Common questions')}

${chalk.bold('Documentation:')}
  ${chalk.dim(APP_LINKS.DOCS)}
`);

// Init Command

program
  .command('init')
  .description('Setup configuration wizard for your project')
  .addHelpText('after', `
${chalk.bold('What it does:')}
  Creates ${chalk.cyan('a11y-config.json')} in your project root with:
  • Framework type (React, Vue, Angular, HTML)
  • Accessibility standard (WCAG AA, AAA, Israeli)
  • RTL support settings
  • Default scan mode

${chalk.bold('Example:')}
  ${chalk.cyan('$')} a11y-guard init
`)
  .action(initCommand);

// -----------------------------------------------------------------------------
// Scan Command
// -----------------------------------------------------------------------------

program
  .command('scan [target]')
  .description('Scan files for accessibility violations')
  .option('-q, --quick', 'Quick scan — fast, skips contrast check')
  .option('-f, --full', 'Full scan — slower, includes contrast check')
  .option('-s, --summary', 'Show only violation counts, no details')
  .option('-o, --output <format>', 'Output format: terminal, json', 'terminal')
  .option('--json-file [filename]', 'Save JSON report to file (auto-names if no filename)')
  .option('--fail-on-critical', 'Exit with code 1 if any critical violations are found')
  .option('--fail-on-serious', 'Exit with code 2 if any serious or critical violations are found')
  .option('--fail-on-any', 'Exit with code 3 if any violations are found')
  .option('--changed', 'Scan only files changed since the last commit (requires git)')
  .option('--watch', 'Watch files and re-scan incrementally on every change')
  .addHelpText('after', `
${chalk.bold('Arguments:')}
  ${chalk.cyan('target')}    Optional file or folder path to scan
            If omitted, scans entire project
            Supported types: ${chalk.dim('.html .htm .jsx .tsx .vue .component.html .component.ts')}

${chalk.bold('Scan Modes:')}
  ${chalk.yellow('--quick')}   Uses JSDOM (fast ~1s, no contrast check)
  ${chalk.green('--full')}    Uses Playwright browser (slower, full checks)

${chalk.bold('Output Options:')}
  ${chalk.dim('Terminal')}  Colored output with clickable file links (default)
  ${chalk.dim('JSON')}      Structured data for CI/CD pipelines
  ${chalk.dim('Summary')}   Just counts, minimal output

${chalk.bold('Examples:')}
  ${chalk.cyan('$')} a11y-guard scan                    ${chalk.dim('# Scan entire project')}
  ${chalk.cyan('$')} a11y-guard scan ./src              ${chalk.dim('# Scan specific folder')}
  ${chalk.cyan('$')} a11y-guard scan ./src/Button.tsx   ${chalk.dim('# Scan specific file')}
  ${chalk.cyan('$')} a11y-guard scan --full             ${chalk.dim('# Full scan with contrast')}
  ${chalk.cyan('$')} a11y-guard scan --summary          ${chalk.dim('# Quick count only')}
  ${chalk.cyan('$')} a11y-guard scan -o json            ${chalk.dim('# JSON to terminal')}
  ${chalk.cyan('$')} a11y-guard scan --json-file        ${chalk.dim('# Save to timestamped file')}
  ${chalk.cyan('$')} a11y-guard scan --json-file report ${chalk.dim('# Save to report.json')}
  ${chalk.cyan('$')} a11y-guard scan --fail-on-critical ${chalk.dim('# Exit 1 if critical violations found')}
  ${chalk.cyan('$')} a11y-guard scan --fail-on-serious  ${chalk.dim('# Exit 2 if serious or critical found')}
  ${chalk.cyan('$')} a11y-guard scan --fail-on-any      ${chalk.dim('# Exit 3 if any violation found')}
  ${chalk.cyan('$')} a11y-guard scan --changed          ${chalk.dim('# Scan only git-changed files')}
  ${chalk.cyan('$')} a11y-guard scan --changed ./src    ${chalk.dim('# Changed files scoped to ./src')}
  ${chalk.cyan('$')} a11y-guard scan --watch            ${chalk.dim('# Watch and re-scan on file change')}
  ${chalk.cyan('$')} a11y-guard scan --watch ./src      ${chalk.dim('# Watch specific folder')}
`)
  .action((target, options) => scanCommand(target, options));

// Help Command (FAQ, Examples)

program
  .command('help [topic]')
  .description('Show detailed help, FAQ, or examples')
  .addHelpText('after', `
${chalk.bold('Available Topics:')}
  ${chalk.cyan('faq')}       Common questions and answers
  ${chalk.cyan('examples')}  Real-world usage examples
  ${chalk.cyan('ci')}        CI/CD integration guide
  ${chalk.cyan('standards')} Accessibility standards explained

${chalk.bold('Usage:')}
  ${chalk.cyan('$')} a11y-guard help faq
  ${chalk.cyan('$')} a11y-guard help examples
`)
  .action((topic) => helpCommand(topic));

// -----------------------------------------------------------------------------
// Parse Arguments
// -----------------------------------------------------------------------------

program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}