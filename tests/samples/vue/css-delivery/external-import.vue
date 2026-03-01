<!--
  external-import.vue

  TEST: import './external.css' (side-effect import) in <script> — ACTIVE (already works)

  cssResolver detects ESM import statements in the raw source file content
  and injects the referenced CSS into the transformed HTML.

  This test validates the existing functionality as a regression baseline.

  Expected — full scan (--full --fail-on-any):
    Violations: vue-ext-fail-gray (~1.6:1), vue-ext-fail-yellow (~1.07:1)
    Clean:      vue-ext-pass-black (21:1), vue-ext-pass-navy (~14.7:1)
    Exit code:  3
-->
<template>
  <main>
    <h1>Vue External CSS Import Test</h1>

    <!-- FAIL: from external.css — ~1.6:1 -->
    <p class="vue-ext-fail-gray">Gray on white — should fail contrast</p>

    <!-- FAIL: from external.css — ~1.07:1 -->
    <p class="vue-ext-fail-yellow">Yellow on white — should fail contrast</p>

    <!-- PASS: from external.css — 21:1 -->
    <p class="vue-ext-pass-black">Black on white — should pass contrast</p>

    <!-- PASS: from external.css — ~14.7:1 -->
    <p class="vue-ext-pass-navy">Navy on white — should pass contrast</p>
  </main>
</template>

<script>
import './external.css';
export default { name: 'ExternalImportTest' };
</script>
