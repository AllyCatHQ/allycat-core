/**
 * AI Prompt Generator
 *
 * Generates per-file, copy-paste AI fix prompts from scan violations.
 * Fully offline — no API calls, no network, no external dependencies.
 *
 * Design decisions:
 *  - One prompt per file (not per violation) — avoids noise, matches workflow
 *  - Template-based — fast, private, works without internet
 *  - Agent-aware tail — optional, read from config.ai.agent
 *  - Pure functions — no side effects, fully testable
 *
 * @module engine/promptGenerator
 */

import { STANDARDS, STANDARD_LABELS } from '../constants.js';

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };

const AGENT_TAILS = {
    claude:   `Think through each fix before writing code. If a fix requires context you don't have (component props, parent structure), state your assumption explicitly before proceeding.`,
    chatgpt:  `Return only the corrected code. No explanations unless asked. Do not wrap output in markdown fences unless requested.`,
    cursor:   `Apply fixes directly in the file. Add a short inline comment above each change: // a11y: <rule-id>`,
    gemini:   `Fix each violation in the order listed. If you are uncertain about a fix, explain your reasoning before writing the corrected code.`,
    copilot:  `Fix each violation listed. Keep all existing logic, imports, and props intact. Only modify what is required for accessibility compliance.`,
    generic:  `Fix each violation listed. Do not change functionality, styling, or logic beyond what is required for accessibility compliance.`,
};

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export function generatePrompts(violations, config) {
    if (!violations || violations.length === 0) return [];
    const byFile = groupViolationsByFile(violations);
    const agentKey = resolveAgentKey(config?.ai?.agent);
    return Object.entries(byFile).map(([file, fileViolations]) => ({
        file,
        prompt: buildFilePrompt(file, fileViolations, config, agentKey),
    }));
}

export function generateFilePrompt(file, violations, config) {
    const agentKey = resolveAgentKey(config?.ai?.agent);
    return buildFilePrompt(file, violations, config, agentKey);
}

// -----------------------------------------------------------------------------
// Prompt Assembly
// -----------------------------------------------------------------------------

function buildFilePrompt(file, violations, config, agentKey) {
    const standard = resolveStandardLabel(config?.selectedStandard);
    const rtlEnabled = config?.rules?.rtl === true;
    const sorted = sortViolationsBySeverity(violations);

    return [
        buildHeader(file, standard, sorted.length),
        buildViolationList(sorted),
        buildInstructions(standard, rtlEnabled),
        buildAgentTail(agentKey),
    ].join('\n\n---\n\n');
}

// -----------------------------------------------------------------------------
// Section Builders
// -----------------------------------------------------------------------------

function buildHeader(file, standard, count) {
    return [
        `## Accessibility Fix Request`,
        ``,
        `You are fixing accessibility violations in the following source file.`,
        `Do NOT change functionality, styling, or logic beyond what is required for the fixes.`,
        ``,
        `**File:** \`${file}\``,
        `**Standard:** ${standard}`,
        `**Violations to fix:** ${count}`,
    ].join('\n');
}

function buildViolationList(violations) {
    const items = violations.map((v, index) => {
        const lines = [
            `**${index + 1}. [${(v.impact || 'unknown').toUpperCase()}] ${v.description}**`,
            `   - Rule: \`${v.id}\``,
        ];
        if (v.lineNumber) lines.push(`   - Line: ${v.lineNumber}`);
        if (v.html) lines.push(`   - Element: \`${truncateSnippet(v.html, 120)}\``);
        if (v.help) lines.push(`   - What to fix: ${v.help}`);
        if (v.wcagTags?.length > 0) lines.push(`   - WCAG: ${v.wcagTags.slice(0, 3).join(', ')}`);
        return lines.join('\n');
    });

    return `### Violations (${violations.length} total)\n\n${items.join('\n\n')}`;
}

function buildInstructions(standard, rtlEnabled) {
    const lines = [
        `### Instructions`,
        ``,
        `1. Fix every violation listed above — do not skip any.`,
        `2. Preserve all existing props, imports, event handlers, and business logic.`,
        `3. Follow ${standard} compliance requirements.`,
        `4. Return the complete corrected file — not just the changed sections.`,
        `5. Add a short inline comment above each fix: \`// a11y: <rule-id>\``,
    ];
    if (rtlEnabled) {
        lines.push(`6. Ensure RTL compatibility — add \`dir="rtl"\` to root elements where required.`);
    }
    return lines.join('\n');
}

function buildAgentTail(agentKey) {
    const tail = AGENT_TAILS[agentKey] || AGENT_TAILS.generic;
    return `### Note\n\n${tail}`;
}

// -----------------------------------------------------------------------------
// Grouping & Sorting
// -----------------------------------------------------------------------------

function groupViolationsByFile(violations) {
    return violations.reduce((acc, violation) => {
        const key = violation.file;
        if (!acc[key]) acc[key] = [];
        acc[key].push(violation);
        return acc;
    }, {});
}

function sortViolationsBySeverity(violations) {
    return [...violations].sort((a, b) => {
        const aOrder = IMPACT_ORDER[a.impact] ?? 4;
        const bOrder = IMPACT_ORDER[b.impact] ?? 4;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return (a.lineNumber || 9999) - (b.lineNumber || 9999);
    });
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function resolveAgentKey(agentValue) {
    if (!agentValue) return 'generic';
    const normalized = String(agentValue).toLowerCase().trim();
    return AGENT_TAILS[normalized] ? normalized : 'generic';
}

function resolveStandardLabel(standard) {
    return STANDARD_LABELS[standard] || STANDARD_LABELS[STANDARDS.WCAG_AA];
}

function truncateSnippet(html, maxLength = 120) {
    if (!html) return '';
    const clean = html.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxLength) return clean;
    return clean.substring(0, maxLength).trimEnd() + '...';
}