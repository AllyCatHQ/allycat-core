<!--
  transitive.vue

  TEST: Transitive @import — Feature 2 (PENDING)
  Imports theme.css via <script> ESM import.
  theme.css contains @import './colors.css'.

  Expected after Feature 2: exit 3 with --fail-on-any
-->
<template>
  <main>
    <h1>Transitive CSS Import Test — Vue</h1>

    <!-- FAIL: from colors.css (via theme.css @import) — ~1.6:1 -->
    <p class="trans-fail-gray">Gray on white — should fail if @import resolved</p>

    <!-- FAIL: from colors.css (via theme.css @import) — ~1.07:1 -->
    <p class="trans-fail-yellow">Yellow on white — should fail if @import resolved</p>

    <!-- PASS: 21:1 -->
    <p class="trans-pass-black">Black on white — should always pass</p>

    <!-- PASS: ~14.7:1 -->
    <p class="trans-pass-navy">Navy on white — should always pass</p>
  </main>
</template>

<script>
import './theme.css'; // theme.css @imports colors.css transitively
export default { name: 'TransitiveVue' };
</script>
