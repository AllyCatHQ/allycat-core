/**
 * style-urls.component.ts
 *
 * TEST: Angular styleUrls — Feature 3, P-1 (PENDING)
 *
 * The @Component decorator declares styleUrls pointing to an external CSS file.
 * Feature 3: angularTsExtractor must extract styleUrls paths and pass them
 * to cssResolver so the CSS is injected before Playwright renders the HTML.
 *
 * Expected after Feature 3:
 *   Violations: ang-fail-gray (~1.6:1), ang-fail-yellow (~1.07:1)
 *   Exit code: 3 with --full --fail-on-any
 *
 * Current state (PENDING): CSS not injected → exit 0
 */
import { Component } from '@angular/core';

@Component({
  selector: 'app-style-urls',
  template: `
    <main>
      <h1>Angular styleUrls CSS Test</h1>

      <!-- FAIL: ang-fail-gray — ~1.6:1 — from style-urls.component.css -->
      <p class="ang-fail-gray">Gray on white — should fail contrast</p>

      <!-- FAIL: ang-fail-yellow — ~1.07:1 — from style-urls.component.css -->
      <p class="ang-fail-yellow">Yellow on white — should fail contrast</p>

      <!-- PASS: ang-pass-black — 21:1 -->
      <p class="ang-pass-black">Black on white — should pass contrast</p>

      <!-- PASS: ang-pass-navy — ~14.7:1 -->
      <p class="ang-pass-navy">Navy on white — should pass contrast</p>
    </main>
  `,
  styleUrls: ['./style-urls.component.css']
})
export class StyleUrlsComponent {}
