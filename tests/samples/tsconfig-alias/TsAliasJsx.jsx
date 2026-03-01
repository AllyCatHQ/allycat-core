/**
 * TsAliasJsx.jsx
 *
 * Feature 5: Custom alias resolution via tsconfig.json paths.
 *
 * @test-theme/ is a custom alias defined in tsconfig.json:
 *   "@test-theme/*": ["tests/samples/tsconfig-alias/theme/*"]
 *
 * Expected: cssResolver reads tsconfig.json → resolves @test-theme/ →
 *           loads contrast-fail.css → Playwright detects violations → exit 3.
 * If alias is NOT resolved: CSS missing → elements use browser defaults → exit 0 (false clean).
 */
import '@test-theme/contrast-fail.css';

export default function TsAliasTest() {
  return (
    <div>
      <p className="alias-fail-gray">Gray text via tsconfig alias — ~1.6:1</p>
      <p className="alias-fail-yellow">Yellow text via tsconfig alias — ~1.07:1</p>
    </div>
  );
}
