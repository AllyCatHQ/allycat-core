/**
 * RtlGood.jsx
 *
 * TEST PURPOSE: RTL correctly declared in JSX.
 *
 * Expected violations with --standard israel:
 *   - NONE for israel-rtl (dir="rtl" is present on root)
 *   - Line 12: <img> missing alt  → image-alt (CRITICAL)  [intentional, unrelated]
 */

export default function RtlGood() {
    return (
        <div dir="rtl">
            <img src="banner.png" />
            <p>תוכן עברי עם כיוון נכון</p>
        </div>
    );
}