/**
 * BadButtons.jsx
 *
 * TEST PURPOSE: Detect button and interactive element violations.
 * Expected result: a11y-guard should report violations on lines below.
 *
 * Violations planted:
 *  - Line 20: <button> completely empty                          → button-name (CRITICAL)
 *  - Line 21: <button> with icon only, no aria-label            → button-name (CRITICAL)
 *  - Line 22: <button> with only whitespace text                → button-name (CRITICAL)
 *  - Line 23: <a> used as button with no href and no text       → link-name (CRITICAL)
 *  - Line 24: <a> with href but no text content or aria-label   → link-name (CRITICAL)
 *  - Line 30: <div> with onClick but no role or keyboard access → (SERIOUS - interactive)
 */

function BadButtons() {
    return (
        <main>
            <h1>Button Test Page</h1>

            <section>
                <h2>Problematic Buttons</h2>

                <button type="button"></button>
                <button type="button"><span aria-hidden="true">🗑</span></button>
                <button type="button">   </button>
                <a onClick={() => {}}>Click me</a>
                <a href="/page"><img src="icon.svg" /></a>

                <p>Some content here.</p>

                <div onClick={() => {}} className="card">Click this card</div>
            </section>

            <section>
                <h2>These buttons are fine</h2>
                <button type="button">Save</button>
                <button type="button" aria-label="Delete item">
                    <span aria-hidden="true">🗑</span>
                </button>
                <a href="/about">About us</a>
                <a href="/docs">
                    <img src="docs-icon.svg" alt="Documentation" />
                </a>
            </section>
        </main>
    );
}

export default BadButtons;
