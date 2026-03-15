/**
 * BadAria.jsx
 *
 * TEST PURPOSE: Detect incorrect ARIA usage violations.
 * Expected result: allycat should report violations on lines below.
 *
 * Violations planted:
 *  - Line 22: aria-label on a <div> with no role                → aria-allowed-attr (SERIOUS)
 *  - Line 23: aria-checked on an element that doesn't support it → aria-allowed-attr (SERIOUS)
 *  - Line 24: role="button" but not keyboard accessible          → interactive-supports-focus (SERIOUS)
 *  - Line 25: aria-hidden="true" on a focusable element         → aria-hidden-focus (SERIOUS)
 *  - Line 26: aria-labelledby pointing to non-existent ID       → aria-valid-attr-value (SERIOUS)
 *  - Line 30: <input> with role that's not allowed on inputs    → aria-allowed-role (MINOR)
 */

function BadAria() {
    return (
        <main>
            <h1>ARIA Test Page</h1>

            <section>
                <h2>Problematic ARIA Usage</h2>

                <div aria-label="some label">Plain div with aria-label but no role</div>
                <span aria-checked="true">Span with aria-checked</span>
                <div role="button">Not keyboard accessible</div>
                <button aria-hidden="true" tabIndex={0}>Hidden but focusable</button>
                <section aria-labelledby="nonexistent-id">
                    <p>This section references an ID that does not exist.</p>
                </section>

                <input type="text" role="button" />
            </section>

            <section>
                <h2>Correct ARIA Usage</h2>
                <div role="button" tabIndex={0} aria-label="Toggle menu">☰</div>
                <div aria-live="polite" id="status-message">Status updates appear here</div>
                <nav aria-label="Breadcrumb">
                    <a href="/">Home</a> &rsaquo; <a href="/products">Products</a>
                </nav>
            </section>
        </main>
    );
}

export default BadAria;
