/**
 * RtlGood.jsx
 *
 * TEST PURPOSE: RTL correctly declared in JSX.
 *
 * Expected violations with rtl: true:
 *   - NONE for rtl-direction (dir="rtl" is present on root)
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