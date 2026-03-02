/**
 * CssModulesTest.jsx
 *
 * TEST: CSS Modules default import + className binding resolution
 *
 * Verifies that:
 *   1. `import s from './CssModulesTest.module.css'` is detected and the
 *      CSS file is injected by cssResolver (default-import pattern).
 *   2. className={s.failGray}       → class="failGray"    (dot notation)
 *   3. className={s['fail-yellow']} → class="fail-yellow" (bracket notation)
 *
 * Expected (full scan --fail-on-any): exit 3 (contrast violations found)
 */
import s from './CssModulesTest.module.css';

export default function CssModulesTest() {
    return (
        <main>
            <h1>CSS Modules Test</h1>

            {/* FAIL: ratio ~1.6:1 — fails WCAG AA — dot notation */}
            <p className={s.failGray}>Gray on white — CSS modules fail</p>

            {/* FAIL: ratio ~1.07:1 — fails WCAG AA — bracket notation */}
            <p className={s['fail-yellow']}>Yellow on white — CSS modules fail</p>

            {/* PASS: ratio 21:1 */}
            <p className={s.passBlack}>Black on white — CSS modules pass</p>
        </main>
    );
}
