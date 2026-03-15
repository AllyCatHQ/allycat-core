/**
 * GoodComponent.jsx
 *
 * TEST PURPOSE: Zero violations baseline.
 * Expected result: allycat should report 0 issues.
 *
 * Covers:
 *  - Images with proper alt text
 *  - Buttons with discernible text
 *  - Form inputs with associated labels
 *  - Correct heading hierarchy
 *  - Proper ARIA usage
 *  - Landmark regions
 */

function GoodComponent() {
    return (
        <main>
            <header>
                <h1>Accessible Page</h1>
                <nav aria-label="Main navigation">
                    <ul>
                        <li><a href="/home">Home</a></li>
                        <li><a href="/about">About</a></li>
                        <li><a href="/contact">Contact</a></li>
                    </ul>
                </nav>
            </header>

            <section aria-labelledby="gallery-heading">
                <h2 id="gallery-heading">Image Gallery</h2>
                <img src="photo.jpg" alt="A sunset over the Mediterranean sea" />
                <img src="logo.png" alt="Company logo" />
                <img src="decorative.png" alt="" role="presentation" />
            </section>

            <section aria-labelledby="form-heading">
                <h2 id="form-heading">Contact Form</h2>
                <div>
                    <label htmlFor="name">Full Name</label>
                    <input id="name" type="text" name="name" />
                </div>
                <div>
                    <label htmlFor="email">Email Address</label>
                    <input id="email" type="email" name="email" />
                </div>
                <div>
                    <label htmlFor="message">Message</label>
                    <textarea id="message" name="message"></textarea>
                </div>
                <button type="submit">Send Message</button>
            </section>

            <section aria-labelledby="actions-heading">
                <h2 id="actions-heading">Actions</h2>
                <button type="button">Save Changes</button>
                <button type="button" aria-label="Close dialog">
                    <span aria-hidden="true">✕</span>
                </button>
            </section>

            <footer>
                <p>© 2025 Accessible Company</p>
            </footer>
        </main>
    );
}

export default GoodComponent;
