/**
 * TransitiveJsx.jsx
 *
 * TEST: Transitive @import — Feature 2 (PENDING)
 *
 * This component imports theme.css, which itself contains:
 *   @import './colors.css';
 *
 * If cssResolver resolves @import directives inside loaded CSS files,
 * the contrast-failing classes from colors.css will be injected into
 * the rendered HTML → axe detects violations.
 *
 * If @import is NOT resolved (current state), only theme.css top-level
 * rules load (.theme-wrapper) — no contrast violations → exit 0.
 *
 * Expected after Feature 2 implementation:
 *   Violations: trans-fail-gray (~1.6:1), trans-fail-yellow (~1.07:1)
 *   Exit code: 3 with --fail-on-any
 */

import React from 'react';
import './theme.css'; // theme.css @imports colors.css transitively

const TransitiveJsx = () => (
    <main>
        <h1>Transitive CSS Import Test — JSX</h1>

        {/* FAIL: from colors.css (via theme.css @import) — ~1.6:1 */}
        <p className="trans-fail-gray">Gray on white — should fail if @import resolved</p>

        {/* FAIL: from colors.css (via theme.css @import) — ~1.07:1 */}
        <p className="trans-fail-yellow">Yellow on white — should fail if @import resolved</p>

        {/* PASS: 21:1 */}
        <p className="trans-pass-black">Black on white — should always pass</p>

        {/* PASS: ~14.7:1 */}
        <p className="trans-pass-navy">Navy on white — should always pass</p>
    </main>
);

export default TransitiveJsx;
