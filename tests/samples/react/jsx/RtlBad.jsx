/**
 * RtlBad.jsx
 *
 * TEST PURPOSE: RTL violation in JSX.
 *
 * Expected violations:
 *   - Line 8: <div> root element missing dir="rtl"  → rtl-direction (SERIOUS)
 *   - Line 9: <img> missing alt                     → image-alt (CRITICAL)
 *   - Line 10: <button> empty                       → button-name (CRITICAL)
 */

export default function RtlBad() {
    return (
        <div lang="he">
            <img src="banner.png" />
            <button></button>
            <p>תוכן עברי ללא כיוון RTL</p>
        </div>
    );
}