#!/usr/bin/env node
import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { scanCommand } from './commands/scan.js';

const program = new Command();

program
  .name('a11y-guard')
  .description('Professional CLI for accessibility compliance')
  .version('1.2.0');

// --- INITIALIZATION COMMAND ---
program
  .command('init')
  .description('Set up the A11y-Guard configuration wizard')
  .action(initCommand);

// --- SCAN COMMAND ---
program
  .command('scan')
  .description('Audit the project for accessibility issues')
  .action(scanCommand);

program.parse(process.argv);