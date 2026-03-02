/**
 * css-delivery.test.js
 *
 * End-to-end tests for CSS delivery method support across all file types.
 *
 * PRINCIPLE:
 *   Each fixture contains elements styled with contrast-failing CSS classes.
 *   If the CSS is correctly injected → Playwright computes contrast → violations found.
 *   If the CSS is NOT injected      → elements use browser defaults (black/white) → clean.
 *
 *   Scan command:  --full --fail-on-any
 *   CSS injected:  exit 3  (violations detected)
 *   CSS missing:   exit 0  (no violations)
 *
 * FEATURE STATUS:
 *   [ACTIVE]  — implemented, assertion counted in pass/fail total
 *   [PENDING] — fixture ready, feature not yet implemented (logged only)
 *
 * Usage:
 *   node tests/e2e/css-delivery.test.js
 *
 * Requirements:
 *   - Playwright + Chromium: npx playwright install chromium
 *   - a11y-config.json present in project root (run: a11y-guard init)
 */

import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const CLI         = path.join(__dirname, '../..', 'src', 'index.js');
const VUE_DIR     = path.join(__dirname, '../samples/vue/css-delivery');
const TRANS       = path.join(__dirname, '../samples/css-transitive');
const ANG_DIR     = path.join(__dirname, '../samples/angular/css-delivery');
const HTML_DIR    = path.join(__dirname, '../samples/html');
const JSX_DIR     = path.join(__dirname, '../samples/react/jsx');
const TSALIAS_DIR = path.join(__dirname, '../samples/tsconfig-alias');

// -----------------------------------------------------------------------------
// Runner
// -----------------------------------------------------------------------------

function runFull(filePath) {
    const result = spawnSync(
        'node',
        [CLI, 'scan', filePath, '--full', '--fail-on-any'],
        {
            encoding: 'utf8',
            cwd: path.join(__dirname, '../..'),
            timeout: 60000,
        }
    );
    // status is null if process was killed (timeout/signal)
    return result.status ?? -1;
}

// -----------------------------------------------------------------------------
// Assertions
// -----------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
    const ok   = actual === expected;
    const icon = ok ? '✓' : '✗';
    console.log(`  ${icon}  ${label}`);
    if (!ok) console.log(`       expected exit ${expected}, got ${actual}`);
    ok ? passed++ : failed++;
}

// -----------------------------------------------------------------------------
// Feature 1 — Vue <style> / <style scoped> extraction
// Root cause: vueTransformer only read <template>; <style> blocks were discarded.
// Fix: extractStyleBlocks() + resolvAndInjectCss extraCssStrings param.
// -----------------------------------------------------------------------------

console.log('\n── Feature 1: Vue <style> / <style scoped> extraction ──────────────');

assert(
    'inline-style.vue:   <style> block injected        → violations found',
    runFull(path.join(VUE_DIR, 'inline-style.vue')),
    3
);

assert(
    'scoped-style.vue:   <style scoped> block injected → violations found',
    runFull(path.join(VUE_DIR, 'scoped-style.vue')),
    3
);

assert(
    'module-style.vue:   <style module> $style[] class resolved → violations found',
    runFull(path.join(VUE_DIR, 'module-style.vue')),
    3
);

assert(
    'external-import.vue: import ./external.css        → violations found  [baseline]',
    runFull(path.join(VUE_DIR, 'external-import.vue')),
    3
);

// -----------------------------------------------------------------------------
// Feature 2 — Transitive @import inside CSS files
// Root cause: cssResolver reads a CSS file but never parses @import directives inside it.
// Fix: after loading a CSS file, scan its content for @import and resolve recursively.
// -----------------------------------------------------------------------------

console.log('\n── Feature 2: Transitive @import inside CSS files ──────────────────');

assert(
    'TransitiveJsx.jsx:  import theme.css → @import colors.css → violations found',
    runFull(path.join(TRANS, 'TransitiveJsx.jsx')),
    3
);

assert(
    'transitive.html:    <link> theme.css  → @import colors.css → violations found',
    runFull(path.join(TRANS, 'transitive.html')),
    3
);

assert(
    'transitive.vue:     import theme.css → @import colors.css → violations found',
    runFull(path.join(TRANS, 'transitive.vue')),
    3
);

// -----------------------------------------------------------------------------
// Feature 3 — Angular styleUrls & inline styles[] array
// Root cause: angularTsExtractor discards styleUrls/styles metadata after template extraction.
// Fix: extract styleUrls paths (resolve + load) and styles[] strings, pass as extraCssStrings.
// -----------------------------------------------------------------------------

console.log('\n── Feature 3: Angular styleUrls & inline styles[] ──────────────────');

assert(
    'style-urls.component.ts:   styleUrls: [./style-urls.component.css] → violations found',
    runFull(path.join(ANG_DIR, 'style-urls.component.ts')),
    3
);

assert(
    'inline-styles.component.ts: styles: [...CSS strings...]             → violations found',
    runFull(path.join(ANG_DIR, 'inline-styles.component.ts')),
    3
);

// -----------------------------------------------------------------------------
// Feature 4 — <link media="print"> filtering
// Root cause: extractCssLinkHrefs does not check the media attribute.
//             Print stylesheets are injected into screen renders → false violations.
// Fix: skip <link> tags where media="print" (one-line check in extractCssLinkHrefs).
// Note: Before fix this test FAILS (exit 3). After fix it PASSES (exit 0).
// -----------------------------------------------------------------------------

console.log('\n── Feature 4: <link media="print"> filtering ────────────────────────');

assert(
    'print-media.html:   print CSS must NOT be injected → no violations (exit 0)',
    runFull(path.join(HTML_DIR, 'print-media.html')),
    0
);

// -----------------------------------------------------------------------------
// Feature 5 — Custom alias resolution via tsconfig.json paths
// Root cause: cssResolver hardcodes only 4 alias prefixes; tsconfig paths ignored.
// Fix: loadTsconfigAliases() reads compilerOptions.paths from tsconfig.json once
//      per scan run and passes the alias map through resolveOnePath().
// -----------------------------------------------------------------------------

console.log('\n── Feature 5: Custom alias resolution (tsconfig.json paths) ─────────');

assert(
    'TsAliasJsx.jsx:  import @test-theme/contrast-fail.css → violations found',
    runFull(path.join(TSALIAS_DIR, 'TsAliasJsx.jsx')),
    3
);

// -----------------------------------------------------------------------------
// Regression — JSX external import (existing baseline, must never break)
// -----------------------------------------------------------------------------

console.log('\n── Regression: JSX external CSS import ─────────────────────────────');

assert(
    'ContrastCssTest.jsx: import ./ContrastCssTest.css  → violations found  [baseline]',
    runFull(path.join(JSX_DIR, 'ContrastCssTest.jsx')),
    3
);

// -----------------------------------------------------------------------------
// Feature 6 — CSS Modules (import s from '*.module.css')
// Root cause: regex only matched side-effect imports; className={s.x} → class="dynamic".
// Fix: default-import regex in cssResolver + extractCssModuleBindings in jsxTransformer.
// -----------------------------------------------------------------------------

console.log('\n── Feature 6: CSS Modules (import s from *.module.css) ─────────────');

assert(
    'CssModulesTest.jsx: className={s.failGray} + {s["fail-yellow"]} → violations found',
    runFull(path.join(JSX_DIR, 'CssModulesTest.jsx')),
    3
);

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

const total = passed + failed;
console.log(`\n  ${passed}/${total} tests passed\n`);
if (failed > 0) process.exit(1);
