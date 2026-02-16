#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { scanCommand } from './commands/scan.js';

const program = new Command();

program
  .name('a11y-guard')
  .description('Professional CLI for accessibility compliance')
  .version('1.0.0');

// --- INITIALIZATION COMMAND ---
program
  .command('init')
  .description('Set up the A11y-Guard configuration wizard')
  .action(initCommand);

// --- SCAN COMMAND ---
program
  .command('scan [target]')
  .description('Audit files for accessibility issues')
  .option('-o, --output <format>', 'Output format: terminal, json', 'terminal')
  .option('-q, --quick', 'Quick scan (fast, skips contrast check)')
  .option('-f, --full', 'Full scan (slower, includes contrast check)')
  .option('--group-by-file', 'Group violations by file (default)', true)
  .action((target, options) => scanCommand(target, options));

program.parse(process.argv);