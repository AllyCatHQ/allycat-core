/**
 * ContrastAndAAA.tsx
 *
 * TEST PURPOSE: Color contrast + WCAG AAA violations.
 *
 * IMPORTANT — Two scan commands needed to see everything:
 *
 *   Quick (AA, no contrast):
 *     allycat scan test-files/react/tsx/ContrastAndAAA.tsx
 *
 *   Full (AAA, with contrast):
 *     allycat scan test-files/react/tsx/ContrastAndAAA.tsx --full
 *
 * Contrast ratios reference:
 *   WCAG AA  normal text → requires 4.5:1
 *   WCAG AA  large text  → requires 3:1
 *   WCAG AAA normal text → requires 7:1
 *   WCAG AAA large text  → requires 4.5:1
 *
 * NOTE ON INLINE STYLES:
 *   Styles must be inlined as object literals (not variables) so the
 *   JSX transformer can serialize them to valid CSS for Playwright rendering.
 *   style={someVariable} → transformer cannot resolve → style dropped → no contrast check
 *   style={{ color: '#fff' }} → transformer serializes → Playwright computes → contrast checked ✅
 *
 * Expected violations — FULL SCAN with --standard wcag-aaa:
 *
 *   AA contrast failures (also fail AAA):
 *    - Line 47: white on white      ~1:1    → color-contrast (CRITICAL)
 *    - Line 48: light gray on white ~1.6:1  → color-contrast (CRITICAL)
 *    - Line 49: yellow on white     ~1.07:1 → color-contrast (CRITICAL)
 *    - Line 50: gray on gray        ~2.3:1  → color-contrast (CRITICAL)
 *
 *   AA pass / AAA fail (only with --standard wcag-aaa):
 *    - Line 55: #767676 on white    ~4.54:1 → color-contrast-enhanced (SERIOUS)
 *    - Line 56: large #5555ff/white ~3.1:1  → color-contrast-enhanced (SERIOUS)
 *
 *   Non-contrast violations (quick scan catches these):
 *    - Line 61: <iframe> no title              → frame-title (SERIOUS)
 *    - Line 62: <video> no controls, no track  → audio-caption (MODERATE)
 *    - Line 63: <input> no label               → label (CRITICAL)
 */

import React from 'react';

const ContrastAndAAA: React.FC = () => {
    return (
        <main>

            {/* ── AA CONTRAST FAILURES ─────────────────────────────────────────── */}
            <section>
                <h1>Color Contrast — AA Failures</h1>
                <p style={{ color: '#ffffff', backgroundColor: '#ffffff', fontSize: '16px' }}>White on white (ratio ~1:1) — invisible</p>
                <p style={{ color: '#cccccc', backgroundColor: '#ffffff', fontSize: '16px' }}>Light gray on white (ratio ~1.6:1)</p>
                <p style={{ color: '#ffff00', backgroundColor: '#ffffff', fontSize: '16px' }}>Yellow on white (ratio ~1.07:1)</p>
                <p style={{ color: '#aaaaaa', backgroundColor: '#bbbbbb', fontSize: '16px' }}>Gray on gray (ratio ~2.3:1)</p>
            </section>

            {/* ── AA PASS / AAA FAIL ───────────────────────────────────────────── */}
            <section>
                <h2>Contrast — Passes AA, Fails AAA</h2>
                <p style={{ color: '#767676', backgroundColor: '#ffffff', fontSize: '16px' }}>Color #767676 on white — passes AA (4.54:1), fails AAA (needs 7:1)</p>
                <p style={{ color: '#5555ff', backgroundColor: '#ffffff', fontSize: '24px' }}>Large blue on white — passes AA-large (3.1:1), fails AAA-large (needs 4.5:1)</p>
            </section>

            {/* ── NON-CONTRAST VIOLATIONS ──────────────────────────────────────── */}
            <section>
                <h2>Structure Violations</h2>
                <iframe src="/embed"></iframe>
                <video src="/video.mp4"></video>
                <input type="text" name="unlabeled" />
            </section>

            {/* ── GOOD SECTION — zero violations ───────────────────────────────── */}
            <section aria-labelledby="good-section">
                <h2 id="good-section">Good Contrast — No Violations</h2>

                {/* Black on white: 21:1 — passes both AA and AAA */}
                <p style={{ color: '#000000', backgroundColor: '#ffffff', fontSize: '16px' }}>
                    Black on white — perfect contrast (21:1)
                </p>

                {/* Navy on white: ~14.7:1 — passes AAA comfortably */}
                <p style={{ color: '#003580', backgroundColor: '#ffffff', fontSize: '16px' }}>
                    Navy on white — passes AAA (14.7:1)
                </p>

                <div>
                    <label htmlFor="good-name">Full Name</label>
                    <input id="good-name" type="text" name="fullname" />
                </div>

                <button type="button">Accessible button</button>
                <a href="/about">About our company</a>
            </section>

        </main>
    );
};

export default ContrastAndAAA;