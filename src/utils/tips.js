import { SCAN_MODES } from '../constants.js';

const TIPS = [
    {
        text: 'File paths with line numbers are clickable in VS Code',
    },
    {
        text: 'Use --full to enable contrast checking',
        when: ({ scanMode }) => scanMode === SCAN_MODES.QUICK,
        weight: 3,
    },
    {
        text: 'Use --summary for a quick violation count',
        when: ({ violationCount }) => violationCount > 10,
        weight: 2,
    },
    {
        text: 'Use --output json for CI/CD integration',
    },
    {
        text: 'Use --json-file to save a report to disk',
    },
    {
        text: 'Use --ci for a CI-friendly preset in one flag',
    },
    {
        text: 'Use --fail-on-critical to block deploys on critical issues',
    },
    {
        text: 'Use --save-baseline to snapshot violations, then --fail-on-new to block regressions',
    },
    {
        text: 'Use --fail-on-new to catch regressions without fixing everything first',
    },
    {
        text: 'Use --changed to scan only git-modified files',
        when: ({ violationCount }) => violationCount > 5,
        weight: 2,
    },
    {
        text: 'Use --watch for live re-scanning on file save',
    },
    {
        text: 'Use --exclude <path> to skip folders or files',
    },
    {
        text: 'Run allycat help examples for real-world usage patterns',
    },
    {
        text: 'Run allycat init to set up a project config file',
    },
    {
        text: 'Use --no-snippet --no-help to reduce output noise',
        when: ({ violationCount }) => violationCount > 15,
        weight: 2,
    },
    {
        text: 'Component violations show the original source line — look for "Source:" in the output',
    },
    {
        text: 'AllyCat supports JSX, TSX, Vue, Angular, and plain HTML',
    },
    {
        text: 'Run allycat report to open the latest HTML report in your browser',
    },
    {
        text: 'Fix violations top-to-bottom to avoid shifting line numbers',
        when: ({ violationCount }) => violationCount > 0,
    },
    {
        text: 'Use --fail-on-serious or --fail-on-any for stricter CI gates',
    },
    {
        text: 'Run allycat update to check for a new version',
    },
    {
        text: 'Found a bug? Run allycat feedback to report it 🐛',
    },
    {
        text: 'Run allycat help faq for common questions',
    },
    {
        text: 'Use --summary-style compact for a single-line summary',
    },
];

const FALLBACK_TIP = TIPS[0].text;

// Community nudge shown occasionally. Kept out of TIPS so it never inflates the
// normal weighted pool — its frequency is controlled solely by PROMO_TIP_CHANCE.
const PROMO_TIP = 'Enjoying AllyCat? miew~ Star or share it — run allycat repo 🌟';
const PROMO_TIP_CHANCE = 0.1;

export function pickTip({ scanMode, violationCount } = {}) {
    // Rare pre-roll: independent of pool size so adding tips never dilutes it.
    if (Math.random() < PROMO_TIP_CHANCE) return PROMO_TIP;

    const ctx = { scanMode, violationCount };

    const eligible = TIPS.filter(t => !t.when || t.when(ctx));
    if (eligible.length === 0) return FALLBACK_TIP;

    const pool = [];
    for (const tip of eligible) {
        const w = tip.weight || 1;
        for (let i = 0; i < w; i++) pool.push(tip.text);
    }

    return pool[Math.floor(Math.random() * pool.length)];
}
