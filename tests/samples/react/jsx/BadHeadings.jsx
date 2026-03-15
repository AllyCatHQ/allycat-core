/**
 * BadHeadings.jsx
 *
 * TEST PURPOSE: Detect heading structure violations.
 * Expected result: allycat should report violations on lines below.
 *
 * Violations planted:
 *  - Line 18: Page starts with <h2> instead of <h1>             → page-has-heading-one (MODERATE)
 *  - Line 19: Jumps from <h2> to <h4>, skips <h3>              → heading-order (MODERATE)
 *  - Line 23: Empty heading                                      → empty-heading (MINOR)
 *  - Line 26: Multiple <h1> elements on the page               → (WCAG AAA)
 */

function BadHeadings() {
    return (
        <main>
            <h2>This Should Be H1</h2>

            <h4>This Skips H3 Entirely</h4>

            <section>
                <h3>Back to H3 - okay here</h3>
                <p>Some content.</p>
                <h5></h5>
            </section>

            <h1>Second H1 on the page</h1>

            <section>
                <h2>Section Title</h2>
                <p>Content here.</p>
            </section>
        </main>
    );
}

export default BadHeadings;
