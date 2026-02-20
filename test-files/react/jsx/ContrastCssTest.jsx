/**
 * ContrastCssTest.jsx
 *
 * TEST PURPOSE:
 *   Verify contrast detection in JSX files across two style delivery methods:
 *
 *     1. Inline style objects  — style={{ color: '#fff', backgroundColor: '#fff' }}
 *        The JSX transformer serializes these to style="" attributes.
 *        Playwright computes contrast from them directly.
 *
 *     2. External CSS import   — import './ContrastCssTest.css'
 *        cssResolver detects this import, reads the file, and injects
 *        its contents into a <style> block in the transformed HTML
 *        before Playwright renders it. axe then detects violations
 *        from those class-based styles.
 *
 * SCAN COMMANDS:
 *   Quick: a11y-guard scan test-files/react/jsx/ContrastCssTest.jsx
 *   Full:  a11y-guard scan test-files/react/jsx/ContrastCssTest.jsx --full
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EXPECTED VIOLATIONS — FULL SCAN (--full, wcag-aa):
 *
 *   SECTION 1 — Inline style objects (transformer serializes these):
 *     Line ~65: inline light gray   ~1.6:1  → color-contrast (CRITICAL)
 *     Line ~66: inline yellow       ~1.07:1 → color-contrast (CRITICAL)
 *     Line ~67: inline gray on gray ~2.3:1  → color-contrast (CRITICAL)
 *
 *   SECTION 2 — External CSS classes (cssResolver must inject these):
 *     .jsx-fail-light-gray   ~1.6:1  → color-contrast (CRITICAL)
 *     .jsx-fail-yellow       ~1.07:1 → color-contrast (CRITICAL)
 *     .jsx-fail-gray-on-gray ~2.3:1  → color-contrast (CRITICAL)
 *     .jsx-fail-invisible    ~1:1    → color-contrast (CRITICAL)
 *
 *   SECTION 3 — Mixed (inline + external class on same element):
 *     background from inline, color from CSS class — Playwright resolves cascade
 *
 * EXPECTED CLEAN (no violations):
 *   All jsx-pass-* class elements
 *   All inline-pass-* elements
 *
 * EXPECTED VIOLATIONS — QUICK SCAN:
 *   None from contrast (JSDOM does not compute contrast)
 * ─────────────────────────────────────────────────────────────────────────
 *
 * NOTE ON INLINE STYLE OBJECTS:
 *   style={{ color: '#fff' }}         ✅ transformer serializes → contrast checked
 *   const s = { color: '#fff' };
 *   style={s}                         ❌ variable — unresolvable statically → dropped
 */

import React from 'react';
import './ContrastCssTest.css';

const ContrastCssTest = () => {
    return (
        <main>
            <h1>JSX Contrast CSS Test</h1>
            <p>Tests contrast detection via inline styles and external CSS import.</p>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SECTION 1: INLINE STYLE OBJECTS                              */}
            {/* Transformer serializes ObjectExpression to style="" attr.    */}
            {/* ══════════════════════════════════════════════════════════════ */}

            <section>
                <h2>Section 1 — Inline Style Objects</h2>

                {/* FAIL: ~1.6:1 */}
                <p style={{ color: '#cccccc', backgroundColor: '#ffffff', fontSize: '16px' }}>
                    Inline: light gray on white (~1.6:1) — SHOULD FAIL AA
                </p>

                {/* FAIL: ~1.07:1 */}
                <p style={{ color: '#ffff00', backgroundColor: '#ffffff', fontSize: '16px' }}>
                    Inline: yellow on white (~1.07:1) — SHOULD FAIL AA
                </p>

                {/* FAIL: ~2.3:1 */}
                <p style={{ color: '#aaaaaa', backgroundColor: '#bbbbbb', fontSize: '16px' }}>
                    Inline: gray on gray (~2.3:1) — SHOULD FAIL AA
                </p>

                {/* PASS: 21:1 */}
                <p style={{ color: '#000000', backgroundColor: '#ffffff', fontSize: '16px' }}>
                    Inline: black on white (21:1) — SHOULD PASS
                </p>

                {/* PASS: ~14.7:1 */}
                <p style={{ color: '#003580', backgroundColor: '#ffffff', fontSize: '16px' }}>
                    Inline: navy on white (~14.7:1) — SHOULD PASS
                </p>
            </section>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SECTION 2: EXTERNAL CSS CLASSES                              */}
            {/* cssResolver reads ContrastCssTest.css and injects it into    */}
            {/* a <style> block in the transformed HTML before Playwright.   */}
            {/* ══════════════════════════════════════════════════════════════ */}

            <section>
                <h2>Section 2 — External CSS Classes</h2>

                {/* FAIL: ~1.6:1 — from ContrastCssTest.css */}
                <p className="jsx-fail-light-gray">
                    External: .jsx-fail-light-gray (~1.6:1) — SHOULD FAIL AA
                </p>

                {/* FAIL: ~1.07:1 — from ContrastCssTest.css */}
                <p className="jsx-fail-yellow">
                    External: .jsx-fail-yellow (~1.07:1) — SHOULD FAIL AA
                </p>

                {/* FAIL: ~2.3:1 — from ContrastCssTest.css */}
                <p className="jsx-fail-gray-on-gray">
                    External: .jsx-fail-gray-on-gray (~2.3:1) — SHOULD FAIL AA
                </p>

                {/* FAIL: ~1:1 — from ContrastCssTest.css */}
                <p className="jsx-fail-invisible">
                    External: .jsx-fail-invisible (~1:1) — SHOULD FAIL AA
                </p>

                {/* PASS: 21:1 — from ContrastCssTest.css */}
                <p className="jsx-pass-black">
                    External: .jsx-pass-black (21:1) — SHOULD PASS
                </p>

                {/* PASS: ~14.7:1 — from ContrastCssTest.css */}
                <p className="jsx-pass-navy">
                    External: .jsx-pass-navy (~14.7:1) — SHOULD PASS
                </p>

                {/* PASS AA / FAIL AAA: ~5.9:1 */}
                <p className="jsx-pass-aa-only">
                    External: .jsx-pass-aa-only (~5.9:1) — PASSES AA, FAILS AAA
                </p>
            </section>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SECTION 3: MIXED — inline background + external class color  */}
            {/* Tests that CSS cascade works correctly after injection.       */}
            {/* Inline style has higher specificity than class in cascade.    */}
            {/* ══════════════════════════════════════════════════════════════ */}

            <section>
                <h2>Section 3 — Mixed Inline + Class</h2>

                {/*
                  backgroundColor from inline (higher specificity) = #ffffff
                  color from .jsx-fail-light-gray class = #cccccc
                  Result: ~1.6:1 — SHOULD FAIL AA

                  Note: inline style wins on backgroundColor,
                  class wins on color (not overridden by inline).
                */}
                <p
                    className="jsx-fail-light-gray"
                    style={{ backgroundColor: '#ffffff', fontSize: '16px' }}
                >
                    Mixed: inline bg + class color (~1.6:1) — SHOULD FAIL AA
                </p>

                {/*
                  backgroundColor from inline = #000000
                  color from .jsx-fail-light-gray class = #cccccc
                  Result: ~1.6:1 on dark bg is actually higher — SHOULD PASS
                  (dark bg + light gray = better contrast than white bg)
                */}
                <p
                    className="jsx-fail-light-gray"
                    style={{ backgroundColor: '#000000', fontSize: '16px' }}
                >
                    Mixed: dark bg overrides class bg, gray text — SHOULD PASS
                </p>
            </section>

        </main>
    );
};

export default ContrastCssTest;
