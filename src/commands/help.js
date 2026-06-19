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

    console.log(chalk.bold.yellow('WCAG 2.2 Level AA') + chalk.dim(' (Industry Frontier)'));
    console.log(`  Everything in WCAG 2.1 AA plus one additional automated check.
  Recommended for new projects started in 2025+.

  ${chalk.dim('Adds (automated):')}
  • Target size minimum 24×24px (SC 2.5.8)

  ${chalk.dim('Note:')} WCAG 2.2 introduced 9 new criteria. axe-core currently automates only SC 2.5.8.
  Full 2.2 AA conformance requires a manual audit for the remaining new criteria.
`);

    console.log(chalk.bold.yellow('WCAG AAA (automated rules)') + chalk.dim(' (Extended)'));
    console.log(`  All AA rules plus every AAA criterion axe-core can automate.
  Often required for government/medical sites. Full AAA requires a manual audit.

  ${chalk.dim('Adds (automated):')}
  • Enhanced contrast (7:1 for normal text)
  • Identical links must have the same purpose
  • No meta-refresh redirects
`);

    console.log(chalk.bold.white('RTL Support') + chalk.dim(' (experimental)'));
    console.log(`  Optional RTL (right-to-left) checking available for all standards.
  Enable during ${chalk.cyan('allycat init')} — applies to Hebrew, Arabic, Persian, and other RTL interfaces.

  ${chalk.dim('Checks:')}
  • Missing dir="rtl" on the root element
  • RTL language detected via lang attribute (he, ar, fa, ur, and more)
`);

    console.log(chalk.bold.white('Comparison Table'));
    console.log('');
    console.log(chalk.dim('  Standard     │ Contrast │ RTL Support │ Use Case'));
    console.log(chalk.dim('  ──────────────────────────────────────────────────────'));
    console.log(chalk.dim('  WCAG 2.1 AA  │ 4.5:1    │ Optional    │ Most websites'));
    console.log(chalk.dim('  WCAG 2.2 AA  │ 4.5:1    │ Optional    │ New projects (2025+)'));
    console.log(chalk.dim('  WCAG AAA     │ 7:1      │ Optional    │ Government/Medical (automated subset)'));
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

    console.log(chalk.bold('Other Commands:'));
    console.log('');
    console.log(`  ${chalk.cyan(CLI.REPORT)}    ${chalk.dim('Open the last report in your browser')}`);
    console.log(`  ${chalk.cyan(CLI.FEEDBACK)}  ${chalk.dim('Report a bug or request a feature on GitHub')}`);
    console.log(`  ${chalk.cyan(CLI.REPO)}      ${chalk.dim('Open the AllyCat GitHub repository')}`);
    console.log(`  ${chalk.cyan(CLI.UPDATE)}    ${chalk.dim('Check for updates and view release notes')}`);
    console.log('');

    console.log(divider);
    console.log(chalk.dim(`Quick start: ${CLI.INIT} && ${CLI.SCAN}`));
    console.log('');
}
