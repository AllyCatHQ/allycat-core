import { glob } from 'glob';
import fs from 'fs/promises';
import { JSDOM } from 'jsdom';
import axe from 'axe-core';

export async function runA11yAudit(config) {
    // 1. Find relevant files
    const patterns = config.framework === 'html' ? '**/*.html' : '**/*.{jsx,tsx,html}';
    const files = await glob(patterns, { ignore: ['node_modules/**', 'dist/**'] });
    
    let allResults = [];

    for (const file of files) {
        const content = await fs.readFile(file, 'utf8');
        
        // 2. Create a virtual DOM for axe-core to scan
        const dom = new JSDOM(content);
        const { window } = dom;

        // 3. Run axe-core on the virtual DOM
        // We tell axe to run only "wcag2aa" rules (the standard you chose)
        const results = await axe.run(window.document, {
            runOnly: {
                type: 'tag',
                values: ['wcag2aa', 'best-practice']
            }
        });

        // 4. Map results back to our format
        if (results.violations.length > 0) {
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

    return allResults;
}