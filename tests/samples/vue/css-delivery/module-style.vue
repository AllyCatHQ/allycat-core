<!--
  module-style.vue

  TEST: Vue <style module> extraction — Feature 1, P-2 (PENDING)

  CSS Modules compile class names to unique hashes at build time.
  Our static scanner extracts the raw CSS, but the :class="$style[...]"
  binding renders as class="dynamic" in the transformed HTML — so the
  injected CSS rules never match the element by class name.

  This is a known limitation documented in CSS-DELIVERY-SUPPORT.md.
  Implementing this would require static analysis of $style[] usage patterns.

  Expected — after P-2 implementation:
    Violations: mod-fail-gray, mod-fail-yellow (if class matching solved)
    Exit code:  3

  Current state (PENDING): Exit code 0 — CSS extracted but classes don't match.
-->
<template>
  <main>
    <h1>Vue CSS Module Test</h1>

    <!-- FAIL (if CSS module class matching implemented) -->
    <p :class="$style['mod-fail-gray']">Gray on white — CSS module fail</p>
    <p :class="$style['mod-fail-yellow']">Yellow on white — CSS module fail</p>

    <!-- PASS -->
    <p :class="$style['mod-pass-black']">Black on white — CSS module pass</p>
    <p :class="$style['mod-pass-navy']">Navy on white — CSS module pass</p>
  </main>
</template>

<script>
export default { name: 'ModuleStyleTest' };
</script>

<style module>
/* ── FAILING ─────────────────────────────────────────────────────────── */

/* ratio ~1.6:1 — fails AA */
.mod-fail-gray {
  color: #cccccc;
  background-color: #ffffff;
  font-size: 16px;
}

/* ratio ~1.07:1 — fails AA */
.mod-fail-yellow {
  color: #ffff00;
  background-color: #ffffff;
  font-size: 16px;
}

/* ── PASSING ─────────────────────────────────────────────────────────── */

/* ratio 21:1 */
.mod-pass-black {
  color: #000000;
  background-color: #ffffff;
  font-size: 16px;
}

/* ratio ~14.7:1 */
.mod-pass-navy {
  color: #003580;
  background-color: #ffffff;
  font-size: 16px;
}
</style>
