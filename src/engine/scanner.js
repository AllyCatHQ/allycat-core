import { glob } from 'glob';
import fs from 'fs/promises';
import { readFileSync, statSync } from 'fs';
import { JSDOM } from 'jsdom';
import { createRequire } from 'module';
import * as p from '@clack/prompts';
import path from 'path';

const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');

export async function runA11yAudit(config, targetPath = null) {
    const files = await resolveFiles(config, targetPath);

    if (files.length === 0) {
        p.log.warn('No matching files found to scan.');
        return [];
    }

    p.log.info(`Found ${files.length} file${files.length > 1 ? 's' : ''} to scan.`);

    const allResults = [];

    for (const file of files) {
        const results = await scanFile(file, config);
        allResults.push(...results);
    }

    return allResults;
}

async function resolveFiles(config, targetPath) {
    // Determine file extensions based on framework
    const extensions = getExtensions(config.framework);

    if (targetPath) {
        return await resolveTargetPath(targetPath, extensions);
    }

    // Default: scan entire project
    const pattern = `**/*.{${extensions.join(',')}}`;
    return await glob(pattern, {
        ignore: ['node_modules/**', 'dist/**', 'build/**']
    });
}

function getExtensions(framework) {
    switch (framework) {
        case 'react':
            return ['jsx', 'tsx', 'html'];
        case 'vue':
            return ['vue', 'html'];
        case 'angular':
            return ['html', 'component.html'];
        case 'html':
        default:
            return ['html'];
    }
}

async function resolveTargetPath(targetPath, extensions) {
    const stats = statSync(targetPath);

    if (stats.isFile()) {
        // Single file - validate extension
        const ext = path.extname(targetPath).slice(1);
        if (extensions.includes(ext)) {
            return [targetPath];
        }
        p.log.warn(`File extension .${ext} not in scan list: ${extensions.join(', ')}`);
        return [targetPath]; // Scan anyway, let the engine handle it
    }

    if (stats.isDirectory()) {
        // Directory - glob within it
        const pattern = `${targetPath}/**/*.{${extensions.join(',')}}`;
        return await glob(pattern, {
            ignore: ['**/node_modules/**', '**/dist/**', '**/build/**']
        });
    }

    return [];
}

async function scanFile(file, config) {
    const results = [];

    try {
        const content = await fs.readFile(file, 'utf8');

        // Create virtual browser environment
        const dom = new JSDOM(content, {
            runScripts: 'dangerously',
            resources: 'usable'
        });

        const { window } = dom;

        // Inject axe-core into the virtual window
        window.eval(axeSource);

        // Run axe audit
        const axeResults = await window.axe.run(window.document, {
            runOnly: {
                type: 'tag',
                values: getAxeTags(config)  // Dynamic based on user config
            },
            reporter: 'v2'
        });

        // Collect violations
        axeResults.violations.forEach(v => {
            results.push({
                file,
                id: v.id,
                impact: v.impact || 'minor',
                description: v.description,
                help: v.help,
            });
        });

        // Israeli RTL check
        if (config.rules.rtl) {
            const rtlViolation = checkRtlCompliance(window.document, file);
            if (rtlViolation) {
                results.push(rtlViolation);
            }
        }

        window.close();

    } catch (err) {
        p.log.error(`Error scanning ${file}: ${err.message}`);
    }

    return results;
}

function checkRtlCompliance(document, file) {
    const htmlTag = document.documentElement;
    const hasRtlDir = htmlTag && htmlTag.getAttribute('dir') === 'rtl';

    if (!hasRtlDir) {
        return {
            file,
            id: 'israel-rtl',
            impact: 'serious',
            description: 'Israeli law requires RTL direction for Hebrew interfaces.',
            help: 'Add dir="rtl" to your <html> tag.',
        };
    }

    return null;
}

function getAxeTags(config) {
    const standard = config.selectedStandard;
    const level = config.rules.level; // 'AA' or 'AAA'

    const tags = ['best-practice'];

    switch (standard) {
        case 'israel':
            // Israeli standard is based on WCAG 2.1 AA
            tags.push('wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa');
            break;
        case 'wcag-aaa':
            // AAA includes all lower levels
            tags.push('wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag21aaa');
            break;
        case 'wcag-aa':
        default:
            tags.push('wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa');
            break;
    }

    return tags;
}