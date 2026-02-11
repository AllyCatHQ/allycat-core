import { glob } from 'glob';
import fs from 'fs/promises';
import { readFileSync } from 'fs';
import { JSDOM } from 'jsdom';
import { createRequire } from 'module';
import * as p from '@clack/prompts';

// טריק קטן כדי להשיג את קובץ המקור של axe-core
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
            // 1. יצירת סביבת דפדפן מדומה שמסוגלת להריץ סקריפטים
            const dom = new JSDOM(content, { 
                runScripts: "dangerously", // מאפשר לנו להזריק קוד JS (את axe)
                resources: "usable"
            });
            
            const { window } = dom;

            // 2. הזרקת המוח: אנחנו טוענים את axe-core לתוך החלון המדומה
            // עכשיו 'window.axe' קיים בתוך ה-JSDOM!
            window.eval(axeSource);

            // 3. הרצה "פנימית"
            // אנחנו לא קוראים ל-axe מה-import שלנו, אלא ל-axe שחי בתוך ה-window
            const results = await window.axe.run(window.document, {
                runOnly: {
                    type: 'tag',
                    values: ['wcag2aa', 'best-practice']
                },
                reporter: 'v2' 
            });

            // 4. איסוף תוצאות
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

            // סגירה נקייה
            window.close();

        } catch (err) {
            p.log.error(`Error auditing ${file}: ${err.message}`);
        }

        // 5. בדיקת RTL הישראלית (סטטית, לא תלויה ב-axe)
        if (config.rules.rtl && !content.includes('dir="rtl"')) {
            allResults.push({
                file,
                id: 'israel-rtl',
                impact: 'serious',
                description: 'Israeli law requires RTL direction for Hebrew interfaces.',
                help: 'Add dir="rtl" to your <html> tag.',
            });
        }
    }

    return allResults;
}