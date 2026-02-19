/**
 * BadForms.jsx
 *
 * TEST PURPOSE: Detect form accessibility violations.
 * Expected result: a11y-guard should report violations on lines below.
 *
 * Violations planted:
 *  - Line 24: <input> with no label, no aria-label           → label (CRITICAL)
 *  - Line 25: <input> with placeholder only (not a label)    → label (CRITICAL)
 *  - Line 26: <input> with label that has wrong `for` value  → label (CRITICAL)
 *  - Line 27: <select> with no label                         → label (CRITICAL)
 *  - Line 28: <textarea> with no label                       → label (CRITICAL)
 *  - Line 35: <input type="image"> with no alt               → input-image-alt (CRITICAL)
 */

function BadForms() {
    return (
        <main>
            <h1>Form Test Page</h1>

            <section>
                <h2>Problematic Form Fields</h2>

                <input type="text" name="username" />
                <input type="email" name="email" placeholder="Enter your email" />
                <label htmlFor="wrong-id">Name</label>
                <input type="text" id="name-field" name="name" />
                <select name="country">
                    <option value="il">Israel</option>
                    <option value="us">United States</option>
                </select>
                <textarea name="message"></textarea>

                <input type="image" src="submit-button.png" />
            </section>

            <section>
                <h2>These fields are fine</h2>
                <div>
                    <label htmlFor="good-name">Full Name</label>
                    <input id="good-name" type="text" name="fullname" />
                </div>
                <div>
                    <label htmlFor="good-email">Email</label>
                    <input id="good-email" type="email" name="email2" aria-required="true" />
                </div>
            </section>
        </main>
    );
}

export default BadForms;
