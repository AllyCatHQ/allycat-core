/*
  NpmCssTest.jsx

  TEST: npm package CSS resolution — Feature 7, P-3 (ACTIVE)

  CSS delivered via a bare npm package import (no leading './' or '/').
  cssResolver.resolveNodeModulesCss() checks node_modules/ starting from
  the source file's directory, then the project root.

  This fixture ships with a local test-only package:
    tests/samples/npm-css/node_modules/test-fail-colors/fail.css
  committed alongside the fixture (.gitignore exception).

  Expected — full scan (--full --fail-on-any):
    Violations: npm-fail-gray (~1.6:1), npm-fail-yellow (~1.07:1)
    Exit code:  3
*/
import 'test-fail-colors/fail.css';

export default function NpmCssTest() {
  return (
    <main>
      <h1>npm Package CSS Test</h1>

      {/* FAIL: color #ccc on #fff → ~1.6:1 — fails WCAG AA */}
      <p className="npm-fail-gray">Gray on white — npm package CSS fail</p>

      {/* FAIL: color #ff0 on #fff → ~1.07:1 — fails WCAG AA */}
      <p className="npm-fail-yellow">Yellow on white — npm package CSS fail</p>

      {/* PASS: color #000 on #fff → 21:1 */}
      <p className="npm-pass-black">Black on white — pass</p>
    </main>
  );
}
