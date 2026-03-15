/**
 * Help Command
 *
 * Provides detailed help, FAQ, examples, and guides.
 *
 * @module commands/help
 */

import chalk from 'chalk';
import { UI, CLI } from '../constants.js';
import { FAQ_ITEMS, EXAMPLE_SECTIONS, GITHUB_ACTIONS_SNIPPET, GITLAB_CI_SNIPPET, JENKINS_SNIPPET } from './helpContent.js';

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
        case 'faq':       showFaq();       break;
        case 'examples':  showExamples();  break;
        case 'ci':        showCiGuide();   break;
        case 'standards': showStandards(); break;
        default:          showTopicList();
    }
}

// -----------------------------------------------------------------------------
// Topic: FAQ
// -----------------------------------------------------------------------------

function showFaq() {
    const divider = chalk.dim(UI.DIVIDER);

    console.log(chalk.bold.cyan('Frequently Asked Questions'));
    console.log(divider);
    console.log('');

    FAQ_ITEMS.forEach((faq, index) => {
        console.log(chalk.bold.white(`Q${index + 1}: ${faq.q}`));
        console.log(chalk.dim(`A: `) + faq.a);
        console.log('');
    });

    console.log(divider);
    console.log(chalk.dim(`More help: ${CLI.HELP} examples`));
    console.log('');
}

// -----------------------------------------------------------------------------
// Topic: Examples
// -----------------------------------------------------------------------------

function showExamples() {
    const divider = chalk.dim(UI.DIVIDER);

    console.log(chalk.bold.cyan('Usage Examples'));
    console.log(divider);
    console.log('');

    EXAMPLE_SECTIONS.forEach(section => {
        console.log(chalk.bold.yellow(section.title));
        section.examples.forEach(ex => {
            console.log(`  ${chalk.cyan('$')} ${chalk.white(ex.cmd)}`);
            console.log(`    ${chalk.dim(ex.desc)}`);
        });
        console.log('');
    });

    console.log(divider);
    console.log(chalk.dim(`More help: ${CLI.HELP} ci`));
    console.log('');
}

// -----------------------------------------------------------------------------
// Topic: CI/CD Guide
// -----------------------------------------------------------------------------

function showCiGuide() {
    const divider = chalk.dim(UI.DIVIDER);

    console.log(chalk.bold.cyan('CI/CD Integration Guide'));
    console.log(divider);
    console.log('');

    console.log(chalk.bold.yellow('GitHub Actions'));
    console.log('');
    console.log(chalk.dim(`  Create ${chalk.white('.github/workflows/accessibility.yml')}:`));
    console.log('');
    console.log(chalk.gray(GITHUB_ACTIONS_SNIPPET));
    console.log('');

    console.log(chalk.bold.yellow('GitLab CI'));
    console.log('');
    console.log(chalk.gray(GITLAB_CI_SNIPPET));
    console.log('');

    console.log(chalk.bold.yellow('Jenkins'));
    console.log('');
    console.log(chalk.gray(JENKINS_SNIPPET));
    console.log('');

    console.log(divider);
    console.log(chalk.dim(`More help: ${CLI.HELP} examples`));
    console.log('');
}

// -----------------------------------------------------------------------------
// Topic: Standards
// -----------------------------------------------------------------------------

function showStandards() {
    const divider = chalk.dim(UI.DIVIDER);

    console.log(chalk.bold.cyan('Accessibility Standards'));
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
    console.log(chalk.dim(`Set your standard: ${CLI.INIT}`));
    console.log('');
}

// -----------------------------------------------------------------------------
// Topic List (Default)
// -----------------------------------------------------------------------------

function showTopicList() {
    const divider = chalk.dim(UI.DIVIDER);

    console.log(chalk.bold.cyan('AllyCat Help'));
    console.log(divider);
    console.log('');

    console.log(chalk.bold('Available Help Topics:'));
    console.log('');
    console.log(`  ${chalk.cyan(`${CLI.HELP} faq`)}       ${chalk.dim('Common questions and answers')}`);
    console.log(`  ${chalk.cyan(`${CLI.HELP} examples`)}  ${chalk.dim('Real-world usage examples')}`);
    console.log(`  ${chalk.cyan(`${CLI.HELP} ci`)}        ${chalk.dim('CI/CD integration guide')}`);
    console.log(`  ${chalk.cyan(`${CLI.HELP} standards`)} ${chalk.dim('Accessibility standards explained')}`);
    console.log('');

    console.log(chalk.bold('Command Help:'));
    console.log('');
    console.log(`  ${chalk.cyan(`${CLI.NAME} --help`)}         ${chalk.dim('Overview of all commands')}`);
    console.log(`  ${chalk.cyan(`${CLI.INIT} --help`)}    ${chalk.dim('Init command options')}`);
    console.log(`  ${chalk.cyan(`${CLI.SCAN} --help`)}    ${chalk.dim('Scan command options')}`);
    console.log('');

    console.log(divider);
    console.log(chalk.dim(`Quick start: ${CLI.INIT} && ${CLI.SCAN}`));
    console.log('');
}
