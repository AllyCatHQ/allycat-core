/**
 * ContrastAndAAA.tsx
 *
 * TEST PURPOSE: Color contrast + WCAG AAA violations.
 * Requires FULL scan: a11y-guard scan test-files/react/ContrastAndAAA.tsx --full
 * Quick scan will NOT catch contrast issues (needs real browser rendering).
 *
 * Contrast ratios explained:
 *   WCAG AA  normal text  → requires 4.5:1
 *   WCAG AA  large text   → requires 3:1
 *   WCAG AAA normal text  → requires 7:1
 *   WCAG AAA large text   → requires 4.5:1
 *
 * Expected violations (full scan --standard wcag-aaa):
 *
 * CONTRAST — AA failures (also fail AAA)
 *  - Line 48: white text on white bg     ratio ~1:1   → color-contrast (CRITICAL)
 *  - Line 49: light gray on white        ratio ~1.6:1 → color-contrast (CRITICAL)
 *  - Line 50: yellow text on white       ratio ~1.07:1→ color-contrast (CRITICAL)
 *  - Line 51: gray on gray              ratio ~2.3:1 → color-contrast (CRITICAL)
 *
 * CONTRAST — AA pass but AAA fail
 *  - Line 56: dark gray on white         ratio ~4.6:1 → color-contrast-enhanced (SERIOUS)
 *  - Line 57: medium blue on white       ratio ~3.1:1 (large) → color-contrast-enhanced (SERIOUS)
 *
 * WCAG AAA — non-contrast violations
 *  - Line 62: <abbr> no title            → definition-list (AAA)
 *  - Line 63: link text not descriptive  → link-name (AAA context)
 *  - Line 64: text spacing issues        → (AAA)
 *  - Line 65: <video> no audio desc      → audio-description (AAA)
 *
 * MIXED — both AA and AAA
 *  - Line 70: focus not visible          → focus-visible (AA+)
 *  - Line 71: <input> no visible label   → label (AA)
 *  - Line 72: motion with no preference  → (AAA)
 */

import React from 'react';

// Inline style objects — the transformer preserves these as style attributes
// so Playwright's layout engine can compute actual contrast ratios
const styles = {
    // AA failures — ratio below 4.5:1 for normal text
    whiteOnWhite:   { color: '#ffffff', backgroundColor: '#ffffff', fontSize: '16px' },
    lightGrayOnWhite: { color: '#cccccc', backgroundColor: '#ffffff', fontSize: '16px' },
    yellowOnWhite:  { color: '#ffff00', backgroundColor: '#ffffff', fontSize: '16px' },
    grayOnGray:     { color: '#aaaaaa', backgroundColor: '#bbbbbb', fontSize: '16px' },

    // AA pass (~4.6:1), AAA fail (needs 7:1) — only caught with --standard wcag-aaa
    darkGrayOnWhite: { color: '#767676', backgroundColor: '#ffffff', fontSize: '16px' },
    // Large text (18px+): AA needs 3:1, AAA needs 4.5:1
    mediumBlueOnWhite: { color: '#5555ff', backgroundColor: '#ffffff', fontSize: '24px' },

    // Focus styling issues
    noOutline: { outline: 'none' },
} as const;

const ContrastAndAAA: React.FC = () => {
    return (
        <main>

            {/* ── AA CONTRAST FAILURES ─────────────────────────────────── */}
            <section>
                <h1>Color Contrast — AA Failures</h1>
                <p style={styles.whiteOnWhite}>White text on white background (ratio ~1:1)</p>
                <p style={styles.lightGrayOnWhite}>Light gray on white (ratio ~1.6:1)</p>
                <p style={styles.yellowOnWhite}>Yellow on white (ratio ~1.07:1)</p>
                <p style={styles.grayOnGray}>Gray on gray (ratio ~2.3:1)</p>
            </section>

            {/* ── AA PASS / AAA FAIL ───────────────────────────────────── */}
            <section>
                <h2>Contrast — AA Pass, AAA Fail</h2>
                <p style={styles.darkGrayOnWhite}>Dark gray on white — passes AA (4.6:1), fails AAA (needs 7:1)</p>
                <p style={styles.mediumBlueOnWhite}>Large blue text — passes AA large (3.1:1), fails AAA large (needs 4.5:1)</p>
            </section>

            {/* ── WCAG AAA NON-CONTRAST ─────────────────────────────────── */}
            <section>
                <h2>WCAG AAA — Non-Contrast</h2>
                <abbr>WHO</abbr>
                <a href="/page1">Click here</a>
                <video src="/video.mp4"></video>
            </section>

            {/* ── FOCUS & INTERACTION ───────────────────────────────────── */}
            <section>
                <h2>Focus & Interaction</h2>
                <button type="button" style={styles.noOutline}>No focus ring</button>
                <input type="text" style={styles.noOutline} />
            </section>

            {/* ── GOOD SECTION — zero violations ───────────────────────── */}
            <section aria-labelledby="good-contrast">
                <h2 id="good-contrast">Good Contrast Examples</h2>
                {/* Black on white — ratio 21:1, passes both AA and AAA */}
                <p style={{ color: '#000000', backgroundColor: '#ffffff', fontSize: '16px' }}>
                    Black on white — perfect contrast
                </p>
                {/* Dark blue on white — ratio ~8.6:1, passes AAA */}
                <p style={{ color: '#003580', backgroundColor: '#ffffff', fontSize: '16px' }}>
                    Navy on white — passes AAA
                </p>
                <div>
                    <label htmlFor="accessible-input">Properly labeled input</label>
                    <input id="accessible-input" type="text" name="name" />
                </div>
                <button type="button">Clearly labeled button</button>
                <a href="/about">About our company</a>
            </section>

        </main>
    );
};

export default ContrastAndAAA;
