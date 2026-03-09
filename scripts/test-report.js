/**
 * test-report.js
 *
 * Demo script — generates a11y-report.html with fake data so you can preview
 * the report UI without running a real scan.
 *
 * Usage:
 *   node scripts/test-report.js
 *
 * Output: a11y-report.html in the project root (same as a real scan).
 */

import { generateReport } from '../src/engine/report/generator.js';

// ---------------------------------------------------------------------------
// Demo violations — 3 files, one violation each
// ---------------------------------------------------------------------------

const demoViolations = [
    {
        file: 'src/components/DemoWidget.jsx',
        id: 'color-contrast',
        impact: 'critical',
        description: 'Elements must meet minimum color contrast ratio thresholds',
        help: 'Ensure the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds.',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
        wcagTags: ['wcag2aa', 'wcag143', 'TTv5', 'TT13.c', 'EN-301-549', 'EN-9.1.4.3', 'ACT'],
        selector: 'header > nav > a.nav-link',
        html: '<a class="nav-link" href="/about">About Us</a>',
        lineNumber: 42,
        failureSummary: 'Fix any of the following:\n  Element has insufficient color contrast of 2.5 (foreground color: #aaaaaa, background color: #ffffff, font size: 14.0pt, font weight: normal). Expected contrast ratio of 4.5:1',
    },
    {
        file: 'src/pages/FooBarPage.jsx',
        id: 'label',
        impact: 'serious',
        description: 'Form elements must have labels',
        help: 'Ensures every form element has a label.',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/label',
        wcagTags: ['wcag2a', 'wcag332', 'wcag131', 'TTv5', 'TT5.c', 'EN-301-549', 'EN-9.3.3.2', 'ACT'],
        selector: 'form#contact input[name="email"]',
        html: '<input type="email" name="email" placeholder="your@email.com" />',
        lineNumber: 87,
        failureSummary: 'Fix any of the following:\n  Form element does not have an implicit (wrapped) <label>\n  Form element does not have an explicit <label>\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty',
    },
    {
        file: 'src/pages/LoremIpsumView.jsx',
        id: 'image-alt',
        impact: 'moderate',
        description: 'Images must have alternate text',
        help: 'Ensures <img> elements have alternate text or a role of none or presentation.',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/image-alt',
        wcagTags: ['wcag2a', 'wcag111', 'TTv5', 'TT7.a', 'TT7.b', 'EN-301-549', 'EN-9.1.1.1', 'ACT'],
        selector: 'main section.hero img',
        html: '<img src="/images/hero-banner.png" class="hero-banner" />',
        lineNumber: 23,
        failureSummary: 'Fix any of the following:\n  Element does not have an alt attribute\n  aria-label attribute does not exist or is empty\n  aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty\n  Element\'s default semantics were not overridden with role="none" or role="presentation"',
    },
];

// ---------------------------------------------------------------------------
// Demo config — mirrors the shape read from a11y-config.json
// ---------------------------------------------------------------------------

const demoConfig = {
    selectedStandard: 'wcag2aa',
    ai: {
        agent: 'claude',
    },
    rules: {
        rtl: false,
    },
};

// ---------------------------------------------------------------------------
// Generate
// ---------------------------------------------------------------------------

const outputPath = generateReport(demoViolations, demoConfig, 'full');
console.log(`\nDemo report generated: ${outputPath}\n`);
