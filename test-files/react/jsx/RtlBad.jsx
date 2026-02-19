/**
 * RtlBad.jsx
 *
 * TEST PURPOSE: RTL violation in JSX (Israeli standard).
 *
 * Expected violations with --standard israel:

 *   - Line 9: <img> missing alt                     → image-alt (CRITICAL)
 *   - Line 10: <button> empty                       → button-name (CRITICAL)
 */

export default function RtlBad() {
    return (
        <div>
            <img src="banner.png" />
            <button></button>
            <p>תוכן עברי ללא כיוון RTL</p>
        </div>
    );
}