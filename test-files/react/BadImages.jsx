/**
 * BadImages.jsx
 *
 * TEST PURPOSE: Detect image accessibility violations.
 * Expected result: a11y-guard should report violations on lines below.
 *
 * Violations planted:
 *  - Line 22: <img> with no alt attribute at all             → image-alt (CRITICAL)
 *  - Line 23: <img> with empty alt but no role="presentation" → image-alt (CRITICAL)
 *  - Line 24: <img> inside <a> with no alt, no link text     → image-alt + link-name (CRITICAL)
 *  - Line 29: <img> with dynamic src, no alt                 → image-alt (CRITICAL)
 */

function BadImages() {
    const logoUrl = '/assets/logo.png';

    return (
        <main>
            <h1>Image Test Page</h1>

            <section>
                <h2>Problematic Images</h2>

                <img src="photo.jpg" />
                <img src="icon.png" alt="" />
                <a href="/home"><img src="home-icon.png" /></a>

                <p>Some text content between images.</p>

                <img src={logoUrl} />
            </section>

            <section>
                <h2>This image is fine</h2>
                <img src="good.jpg" alt="A descriptive text for this image" />
            </section>
        </main>
    );
}

export default BadImages;
