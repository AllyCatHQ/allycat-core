<!--
  module-style.vue

  TEST: Vue <style module> extraction — Feature 1, P-2 (ACTIVE)

  tryExtractStyleModuleClass() in vueTransformer.js resolves :class="$style['name']"
  and :class="$style.name" bindings to their literal class names at transform time,
  so the injected CSS rules match the rendered elements.

  Expected — full scan (--full --fail-on-any):
    Violations: mod-fail-gray (~1.6:1), mod-fail-yellow (~1.07:1)
    Exit code:  3
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
