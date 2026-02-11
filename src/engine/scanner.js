import { glob } from 'glob';
import fs from 'fs/promises';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';
import * as p from '@clack/prompts';

export async function runA11yAudit(config) {
    // 1. Find relevant files
    const patterns = config.framework === 'html' ? '**/*.html' : '**/*.{jsx,tsx,html}';
    const files = await glob(patterns, { ignore: ['node_modules/**', 'dist/**'] });
    
    p.log.info(`Found ${files.length} files to scan.`);
    let allResults = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        p.log.step(`[${i + 1}/${files.length}] Scanning: ${file}`);
        
        const content = await fs.readFile(file, 'utf8');
        
        // 2. Create a virtual DOM for axe-core to scan
        const dom = new JSDOM(content);
        const { window } = dom;

        // 3. Run axe-core on the virtual DOM
        const results = await axe.run(window.document, {
            runOnly: {
                type: 'tag',
                values: ['wcag2aa', 'best-practice']
            }
        });

        // 4. Map results back to our format
        if (results.violations.length > 0) {
            p.log.warn(`Found ${results.violations.length} violations in ${file}`);
            results.violations.forEach(v => {
                allResults.push({
                    file,
                    id: v.id,
                    impact: v.impact,
                    description: v.description,
                    help: v.help,
                    nodes: v.nodes.length // How many elements broke this rule
                });
            });
        }
        
        // 5. Custom Israeli Rule: RTL Check
        if (config.rules.rtl && !content.includes('dir="rtl"')) {
            p.log.warn(`Missing RTL attribute in ${file}`);
            allResults.push({
                file,
                id: 'israel-rtl',
                impact: 'serious',
                description: 'Israeli law requires RTL direction for Hebrew interfaces.',
                help: 'Add dir="rtl" to your wrapper element or <html> tag.',
                nodes: 1
            });
        }
    }

    p.log.success(`Audit finished. Total issues found: ${allResults.length}`);
    return allResults;
}