<!--
  inline-style.vue

  TEST: Vue <style> block extraction — Feature 1, P-1 (ACTIVE)

  CSS delivered via a plain <style> block in the SFC.
  If vueTransformer extracts it and cssResolver injects it → axe detects
  contrast violations from the .vue-* classes.

  Expected — full scan (--full --fail-on-any):
    Violations: vue-fail-gray (~1.6:1), vue-fail-yellow (~1.07:1)
    Clean:      vue-pass-black (21:1), vue-pass-navy (~14.7:1)
    Exit code:  3 (violations found → --fail-on-any triggered)

  Expected — without style extraction (bug state):
    No contrast violations (elements use browser defaults → black on white)
    Exit code: 0
-->
<template>
  <main>
    <h1>Vue Inline Style Block Test</h1>

    <!-- FAIL: color #ccc on #fff → ~1.6:1 — fails WCAG AA -->
    <p class="vue-fail-gray">Gray on white — should fail contrast</p>

    <!-- FAIL: color #ff0 on #fff → ~1.07:1 — fails WCAG AA -->
    <p class="vue-fail-yellow">Yellow on white — should fail contrast</p>

    <!-- PASS: color #000 on #fff → 21:1 — passes AA + AAA -->
    <p class="vue-pass-black">Black on white — should pass contrast</p>

    <!-- PASS: color #003580 on #fff → ~14.7:1 — passes AAA -->
    <p class="vue-pass-navy">Navy on white — should pass contrast</p>
  </main>
</template>

<script>
export default { name: 'InlineStyleTest' };
</script>

<style>
/* ── FAILING (contrast below WCAG AA 4.5:1) ─────────────────────────── */

/* ratio ~1.6:1 — fails AA */
.vue-fail-gray {
  color: #cccccc;
  background-color: #ffffff;
  font-size: 16px;
}

/* ratio ~1.07:1 — fails AA */
.vue-fail-yellow {
  color: #ffff00;
  background-color: #ffffff;
  font-size: 16px;
}

/* ── PASSING ─────────────────────────────────────────────────────────── */

/* ratio 21:1 — passes AA + AAA */
.vue-pass-black {
  color: #000000;
  background-color: #ffffff;
  font-size: 16px;
}

/* ratio ~14.7:1 — passes AAA */
.vue-pass-navy {
  color: #003580;
  background-color: #ffffff;
  font-size: 16px;
}
</style>
