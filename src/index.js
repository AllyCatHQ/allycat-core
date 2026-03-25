#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import { createRequire } from 'module';
import { initCommand } from './commands/init.js';
import { scanCommand } from './commands/scan.js';
import { helpCommand } from './commands/help.js';
import { UI, APP_LINKS, SUPPORTED_EXTENSIONS_DISPLAY } from './constants.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json');

const program = new Command();

// Program Configuration

program
  .name('allycat')
  .description(`
${chalk.bold('AllyCat')} — Professional CLI for accessibility compliance testing.

Supports ${chalk.cyan('WCAG 2.1 AA/AAA')} and ${chalk.cyan('Israeli Standard IS 5568')}.
Fast scanning with precise error locations and clickable VS Code links.
    `.trim())
  .version(version, '-v, --version', 'Display version number')
  .helpOption('-h, --help', 'Display help information')
  .addHelpText('after', `
${chalk.dim(UI.DIVIDER)}

${chalk.bold('Quick Start:')}
  ${chalk.cyan('$')} allycat init          ${chalk.dim('# Setup configuration')}
  ${chalk.cyan('$')} allycat scan          ${chalk.dim('# Scan your project')}

${chalk.bold('Learn More:')}
  ${chalk.cyan('$')} allycat help examples ${chalk.dim('# See usage examples')}
  ${chalk.cyan('$')} allycat help faq      ${chalk.dim('# Common questions')}

${chalk.bold('Documentation:')}
  ${chalk.dim(APP_LINKS.DOCS)}
`);

// Init Command

program
  .command('init')
  .description('Setup configuration wizard for your project')
  .addHelpText('after', `
${chalk.bold('What it does:')}
  Creates ${chalk.cyan('allycat.config.json')} in your project root with:
  • Framework type (React, Vue, Angular, HTML)
  • Accessibility standard (WCAG AA, AAA, Israeli)
  • RTL support settings
  • Default scan mode

${chalk.bold('Example:')}
  ${chalk.cyan('$')} allycat init
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
  .option('-j, --json-file [filename]', 'Save JSON report to file (auto-names if no filename)')
  .option('--fail-on-critical', 'Exit with code 1 if any critical violations are found')
  .option('--fail-on-serious', 'Exit with code 2 if any serious or critical violations are found')
  .option('--fail-on-any', 'Exit with code 3 if any violations are found')
  .option('-c, --changed', 'Scan only files changed since the last commit (requires git)')
  .option('-w, --watch', 'Watch files and re-scan incrementally on every change')
  .option('-e, --existing', 'In watch mode: show full details of pre-existing violations on startup (default: counts only)')
  .option('--save-baseline', 'Save all current violations as a baseline — exits 0 always')
  .option('--fail-on-new', 'Exit code 4 if any violation is not in the baseline (requires --save-baseline to have been run first)')
  .addHelpText('after', `
${chalk.bold('Arguments:')}
  ${chalk.cyan('target')}    Optional file or folder path to scan
            If omitted, scans entire project
            Supported types: ${chalk.dim(SUPPORTED_EXTENSIONS_DISPLAY)}

${chalk.bold('Scan Modes:')}
  ${chalk.yellow('--quick')}   Uses JSDOM (fast ~1s, no contrast check)
  ${chalk.green('--full')}    Uses Playwright browser (slower, full checks)

${chalk.bold('Output Options:')}
  ${chalk.dim('Terminal')}  Colored output with clickable file links (default)
  ${chalk.dim('JSON')}      Structured data for CI/CD pipelines
  ${chalk.dim('Summary')}   Just counts, minimal output

${chalk.bold('Examples:')}
  ${chalk.cyan('$')} allycat scan                    ${chalk.dim('# Scan entire project')}
  ${chalk.cyan('$')} allycat scan ./src              ${chalk.dim('# Scan specific folder')}
  ${chalk.cyan('$')} allycat scan ./src/Button.tsx   ${chalk.dim('# Scan specific file')}
  ${chalk.cyan('$')} allycat scan --full             ${chalk.dim('# Full scan with contrast')}
  ${chalk.cyan('$')} allycat scan --summary          ${chalk.dim('# Quick count only')}
  ${chalk.cyan('$')} allycat scan -o json            ${chalk.dim('# JSON to terminal')}
  ${chalk.cyan('$')} allycat scan --json-file        ${chalk.dim('# Save to timestamped file')}
  ${chalk.cyan('$')} allycat scan --json-file report ${chalk.dim('# Save to report.json')}
  ${chalk.cyan('$')} allycat scan --fail-on-critical ${chalk.dim('# Exit 1 if critical violations found')}
  ${chalk.cyan('$')} allycat scan --fail-on-serious  ${chalk.dim('# Exit 2 if serious or critical found')}
  ${chalk.cyan('$')} allycat scan --fail-on-any      ${chalk.dim('# Exit 3 if any violation found')}
  ${chalk.cyan('$')} allycat scan --changed          ${chalk.dim('# Scan only git-changed files')}
  ${chalk.cyan('$')} allycat scan --changed ./src    ${chalk.dim('# Changed files scoped to ./src')}
  ${chalk.cyan('$')} allycat scan --watch            ${chalk.dim('# Watch and re-scan on file change')}
  ${chalk.cyan('$')} allycat scan --watch ./src      ${chalk.dim('# Watch specific folder')}
  ${chalk.cyan('$')} allycat scan --watch --existing   ${chalk.dim('# Watch — show full pre-existing violation details on startup')}
  ${chalk.cyan('$')} allycat scan --save-baseline      ${chalk.dim('# Snapshot all current violations to .a11y-baseline.json')}
  ${chalk.cyan('$')} allycat scan --fail-on-new         ${chalk.dim('# Exit 4 if any violation is not in the baseline')}
  ${chalk.cyan('$')} allycat scan --fail-on-new --fail-on-critical ${chalk.dim('# Combine baseline gate with severity gate')}
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
  ${chalk.cyan('$')} allycat help faq
  ${chalk.cyan('$')} allycat help examples
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