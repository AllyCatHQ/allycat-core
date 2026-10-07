import chalk from 'chalk';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { openInTerminal } from '../utils/terminalOpener.js';

// Hardcoded dummy violation — just to prove the prompt-passing mechanism works.
// Stage 2 will replace this with violations loaded from the stored scan.
const DUMMY_VIOLATION = {
    file: 'src/components/Button.tsx',
    ruleId: 'image-alt',
    impact: 'critical',
    line: 14,
    snippet: '<img src={icon} className="submit-icon" />',
    description: 'Image elements must have an alt attribute describing the image.',
};

export function fixCommand() {
    const v = DUMMY_VIOLATION;

    const prompt = `\
# AllyCat — Accessibility Fix Request

## File
${v.file}

## Violation
- Rule: ${v.ruleId}
- Impact: ${v.impact}
- Line: ${v.line}
- Description: ${v.description}

## Code
\`\`\`
${v.snippet}
\`\`\`

## Task
Fix the accessibility violation above in ${v.file}.
Make targeted edits only — do not rewrite the file.
`;

    const tmpPath = join(tmpdir(), `allycat-fix-${Date.now()}.md`);
    writeFileSync(tmpPath, prompt, 'utf8');

    console.log(chalk.dim('Violation to fix:'));
    console.log(`  ${chalk.red(v.impact.toUpperCase())} ${chalk.cyan(v.ruleId)} — ${v.file}:${v.line}`);
    console.log(chalk.dim('\nOpening Claude Code in a new terminal tab...'));

    openInTerminal('claude', [`Read ${tmpPath} and follow the instructions inside it.`], { cwd: process.cwd() });
}
