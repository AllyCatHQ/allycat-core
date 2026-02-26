/**
 * ComprehensiveTest.tsx
 *
 * TEST PURPOSE: Full coverage accessibility scan for TSX files.
 * Tests WCAG 2.1 AA violations across every major category.
 * Run with: a11y-guard scan test-files/react/ComprehensiveTest.tsx
 *
 * Expected violations (quick scan):
 *
 * IMAGES
 *  - Line 28: <img> no alt                          → image-alt (CRITICAL)
 *  - Line 29: <img> empty alt, no role              → image-alt (CRITICAL)
 *  - Line 30: <img> inside <a>, no alt, no text     → image-alt + link-name (CRITICAL)
 *
 * BUTTONS & INTERACTIVE
 *  - Line 35: <button> empty                        → button-name (CRITICAL)
 *  - Line 36: <button> icon only, no aria-label     → button-name (CRITICAL)
 *  - Line 37: <a> with href, no text, no label      → link-name (SERIOUS)
 *
 * FORMS
 *  - Line 42: <input> no label                      → label (CRITICAL)
 *  - Line 43: <input> placeholder only              → label (CRITICAL)
 *  - Line 44: <select> no label                     → select-name (CRITICAL)
 *  - Line 45: <textarea> no label                   → label (CRITICAL)
 *  - Line 46: <input type="image"> no alt           → input-image-alt (CRITICAL)
 *
 * HEADINGS
 *  - Line 51: starts with <h2>, no <h1>             → page-has-heading-one (MODERATE)
 *  - Line 52: jumps h2 → h4                         → heading-order (MODERATE)
 *  - Line 53: empty heading                          → empty-heading (MINOR)
 *
 * ARIA
 *  - Line 58: <span> aria-checked (not supported)   → aria-allowed-attr (CRITICAL)
 *  - Line 59: <input> role="button" (not allowed)   → aria-allowed-role (MINOR)
 *  - Line 60: <button> aria-hidden + tabIndex       → aria-hidden-focus (SERIOUS)
 *  - Line 61: aria-labelledby → nonexistent ID      → aria-valid-attr-value (CRITICAL)
 *
 * LANGUAGE & STRUCTURE
 *  - Line 66: <table> no caption/summary            → table-duplicate-name (MODERATE)
 *  - Line 67: <td> used as header, no scope         → td-headers-attr (MODERATE)
 *  - Line 71: <frame> / <iframe> no title           → frame-title (SERIOUS)
 *  - Line 72: <audio> no controls                   → audio-caption (MODERATE)
 *
 * TYPESCRIPT-SPECIFIC (verifying TSX transformer handles types correctly)
 *  - Line 77: typed props, no alt on img            → image-alt (CRITICAL)
 *  - Line 78: generic component renders bad button  → button-name (CRITICAL)
 */

import React from 'react';

// TypeScript interfaces — transformer must skip these cleanly
interface CardProps {
    title: string;
    onClick: () => void;
}

type ButtonVariant = 'primary' | 'secondary' | 'danger';

const ComprehensiveTest: React.FC = () => {
    const dynamicSrc: string = '/images/dynamic.jpg';
    const isVisible: boolean = true;

    return (
        <main>

            {/* ── IMAGES ───────────────────────────────────────────────── */}
            <section>
                <h1>Images</h1>
                <img src="photo.jpg" />
                <img src="icon.png" alt="" />
                <a href="/home"><img src="home-icon.png" /></a>
            </section>

            {/* ── BUTTONS & INTERACTIVE ────────────────────────────────── */}
            <section>
                <h2>Buttons</h2>
                <button type="button"></button>
                <button type="button"><span aria-hidden="true">✕</span></button>
                <a href="/page"><img src="icon.svg" /></a>
            </section>

            {/* ── FORMS ────────────────────────────────────────────────── */}
            <section>
                <h2>Forms</h2>
                <input type="text" name="username" />
                <input type="email" name="email" placeholder="Enter email" />
                <select name="country"><option value="il">Israel</option></select>
                <textarea name="message"></textarea>
                <input type="image" src="submit.png" />
            </section>

            {/* ── HEADINGS ─────────────────────────────────────────────── */}
            <section>
                <h2>This page already has an H1 above — this is fine</h2>
                <h4>Skips H3 entirely</h4>
                <h5></h5>
            </section>

            {/* ── ARIA ─────────────────────────────────────────────────── */}
            <section>
                <h2>ARIA</h2>
                <span aria-checked="true">Bad aria-checked on span</span>
                <input type="text" role="button" />
                <button aria-hidden="true" tabIndex={0}>Hidden focusable</button>
                <section aria-labelledby="does-not-exist"><p>Bad labelledby</p></section>
            </section>

            {/* ── STRUCTURE ────────────────────────────────────────────── */}
            <section>
                <h2>Structure</h2>
                <table>
                    <tr><td>Cell without header scope</td></tr>
                </table>
                <iframe src="/embed"></iframe>
                <audio src="/track.mp3"></audio>
            </section>

            {/* ── TYPESCRIPT-SPECIFIC ──────────────────────────────────── */}
            <section>
                <h2>TypeScript patterns</h2>
                <img src={dynamicSrc} />
                <button type={undefined as unknown as 'button'}></button>
            </section>

            {/* ── GOOD SECTION (should produce zero violations) ─────────── */}
            <section aria-labelledby="good-heading">
                <h2 id="good-heading">Accessible elements</h2>
                <img src="photo.jpg" alt="A descriptive caption" />
                <button type="button" aria-label="Close dialog">
                    <span aria-hidden="true">✕</span>
                </button>
                <div>
                    <label htmlFor="good-input">Full Name</label>
                    <input id="good-input" type="text" name="fullname" />
                </div>
                <a href="/about">About us</a>
            </section>

        </main>
    );
};

export default ComprehensiveTest;
