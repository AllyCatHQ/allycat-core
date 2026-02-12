import { glob } from 'glob';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { createRequire } from 'module';
import * as p from '@clack/prompts';

// Small trick to get the axe-core source file
const require = createRequire(import.meta.url);
const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');

export async function runA11yAudit(config) {
    const patterns = config.framework === 'html' ? '**/*.html' : '**/*.{jsx,tsx,html}';
    const files = await glob(patterns, { ignore: ['node_modules/**', 'dist/**', 'build/**'] });

    p.log.info(`Found ${files.length} files to scan.`);
    let allResults = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await fs.readFile(file, 'utf8');

        try {
            // 1. Create a virtual browser environment that can run scripts
            const dom = new JSDOM(content, {
                runScripts: "dangerously", // Allows us to inject JS code (axe)
                resources: "usable"
            });

            const { window } = dom;

            // 2. Inject the brain: we load axe-core into the virtual window
            // Now 'window.axe' exists inside the JSDOM!
            window.eval(axeSource);

            // 3. Internal execution
            // We don't call axe from our import, but the axe that lives inside the window
            const results = await window.axe.run(window.document, {
                runOnly: {
                    type: 'tag',
                    values: ['wcag2aa', 'best-practice']
                },
                reporter: 'v2'
            });

            // 4. Collect results
            if (results.violations.length > 0) {
                results.violations.forEach(v => {
                    allResults.push({
                        file,
                        id: v.id,
                        impact: v.impact || 'minor',
                        description: v.description,
                        help: v.help,
                    });
                });
            }

            // 5. Israeli RTL check (static, not dependent on axe)
            // Check if the HTML tag has dir="rtl" attribute
            if (config.rules.rtl) {
                const htmlTag = window.document.documentElement;
                const hasRtlDir = htmlTag && htmlTag.getAttribute('dir') === 'rtl';

                if (!hasRtlDir) {
                    allResults.push({
                        file,
                        id: 'israel-rtl',
                        impact: 'serious',
                        description: 'Israeli law requires RTL direction for Hebrew interfaces.',
                        help: 'Add dir="rtl" to your <html> tag.',
                    });
                }
            }

            // Clean closure
            window.close();

        } catch (err) {
            p.log.error(`Error auditing ${file}: ${err.message}`);
        }
    }

    return allResults;
}