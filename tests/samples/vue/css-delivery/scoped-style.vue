<!--
  scoped-style.vue

  TEST: Vue <style scoped> block extraction — Feature 1, P-1 (ACTIVE)

  CSS delivered via <style scoped>. Scoped styles apply only to elements
  in this component. The `scoped` attribute adds a data attribute hash in
  real Vue builds — in our static scanner we extract the raw CSS content
  and inject it as-is (no hash transformation needed for a11y scanning).

  Expected — full scan (--full --fail-on-any):
    Violations: vue-scoped-fail-gray (~1.6:1), vue-scoped-fail-yellow (~1.07:1)
    Clean:      vue-scoped-pass-black (21:1), vue-scoped-pass-navy (~14.7:1)
    Exit code:  3

  Expected — without style extraction (bug state):
    Exit code: 0
-->
<template>
  <main>
    <h1>Vue Scoped Style Block Test</h1>

    <!-- FAIL: color #ccc on #fff → ~1.6:1 — fails WCAG AA -->
    <p class="vue-scoped-fail-gray">Gray on white — should fail contrast</p>

    <!-- FAIL: color #ff0 on #fff → ~1.07:1 — fails WCAG AA -->
    <p class="vue-scoped-fail-yellow">Yellow on white — should fail contrast</p>

    <!-- PASS: color #000 on #fff → 21:1 -->
    <p class="vue-scoped-pass-black">Black on white — should pass contrast</p>

    <!-- PASS: color #003580 on #fff → ~14.7:1 -->
    <p class="vue-scoped-pass-navy">Navy on white — should pass contrast</p>
  </main>
</template>

<script>
export default { name: 'ScopedStyleTest' };
</script>

<style scoped>
/* ── FAILING ─────────────────────────────────────────────────────────── */

/* ratio ~1.6:1 — fails AA */
.vue-scoped-fail-gray {
  color: #cccccc;
  background-color: #ffffff;
  font-size: 16px;
}

/* ratio ~1.07:1 — fails AA */
.vue-scoped-fail-yellow {
  color: #ffff00;
  background-color: #ffffff;
  font-size: 16px;
}

/* ── PASSING ─────────────────────────────────────────────────────────── */

/* ratio 21:1 — passes AA + AAA */
.vue-scoped-pass-black {
  color: #000000;
  background-color: #ffffff;
  font-size: 16px;
}

/* ratio ~14.7:1 — passes AAA */
.vue-scoped-pass-navy {
  color: #003580;
  background-color: #ffffff;
  font-size: 16px;
}
</style>
