/**
 * inline-styles.component.ts
 *
 * TEST: Angular inline styles[] array — Feature 3, P-2 (PENDING)
 *
 * The @Component decorator contains a `styles` array with raw CSS strings.
 * Feature 3: angularTsExtractor must extract these string literals and pass
 * them directly to cssResolver (no file path — already raw CSS content).
 *
 * Expected after Feature 3:
 *   Violations: ang-inline-fail-gray (~1.6:1), ang-inline-fail-yellow (~1.07:1)
 *   Exit code: 3 with --full --fail-on-any
 *
 * Current state (PENDING): CSS not injected → exit 0
 */
import { Component } from '@angular/core';

@Component({
  selector: 'app-inline-styles',
  template: `
    <main>
      <h1>Angular Inline Styles Array Test</h1>

      <!-- FAIL: ~1.6:1 — from styles[] array -->
      <p class="ang-inline-fail-gray">Gray on white — should fail contrast</p>

      <!-- FAIL: ~1.07:1 — from styles[] array -->
      <p class="ang-inline-fail-yellow">Yellow on white — should fail contrast</p>

      <!-- PASS: 21:1 -->
      <p class="ang-inline-pass-black">Black on white — should pass contrast</p>

      <!-- PASS: ~14.7:1 -->
      <p class="ang-inline-pass-navy">Navy on white — should pass contrast</p>
    </main>
  `,
  styles: [
    '.ang-inline-fail-gray { color: #cccccc; background-color: #ffffff; font-size: 16px; }',
    '.ang-inline-fail-yellow { color: #ffff00; background-color: #ffffff; font-size: 16px; }',
    '.ang-inline-pass-black { color: #000000; background-color: #ffffff; font-size: 16px; }',
    '.ang-inline-pass-navy { color: #003580; background-color: #ffffff; font-size: 16px; }'
  ]
})
export class InlineStylesComponent {}
