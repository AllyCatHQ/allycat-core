<template>
  <div>

    <!-- EC-1: inner <template v-if> fragment — children rendered without a wrapper element -->
    <template v-if="show">
      <h1>Page Title</h1>
      <h3>Skipped heading inside fragment</h3>
    </template>

    <!-- EC-2: PascalCase custom component — should render children inside a <div> proxy -->
    <MyModal>
      <img src="modal.png">
    </MyModal>

    <!-- EC-3: kebab-case component + :[dynamicProp] dynamic attr name — dynamic attr must be ignored -->
    <form-field :[dynamicProp]="val" aria-label="Name field">
      <input type="search">
    </form-field>

    <!-- EC-4: RouterLink → rendered as <a> so axe can check link rules -->
    <RouterLink to="/about">click here</RouterLink>

    <!-- EC-5: v-bind="attrs" spread — must be skipped entirely -->
    <section v-bind="attrs">
      <input type="email">
    </section>

    <!-- EC-6: v-model — should produce value="dynamic", input still lacks label -->
    <input v-model="username" type="text">

    <!-- EC-7: :aria-label with static string literal — must resolve, button must NOT trigger button-name -->
    <button :aria-label="'Close dialog'">×</button>

    <!-- EC-8: <Transition> built-in — rendered as <div>, children still scanned -->
    <Transition name="fade">
      <img :src="imgSrc">
    </Transition>

    <!-- EC-9: inner <template v-for> fragment — children rendered without a wrapper -->
    <template v-for="item in list" :key="item.id">
      <div role="listitem">{{ item.label }}</div>
    </template>

    <!-- EC-10: <slot> — rendered as <span>, should not crash -->
    <slot />

  </div>
</template>

<script setup>
import { ref } from 'vue';
const show = ref(true);
const username = ref('');
const imgSrc = ref('/image.png');
const list = ref([]);
const attrs = {};
const dynamicProp = 'data-id';
const val = '42';
</script>
