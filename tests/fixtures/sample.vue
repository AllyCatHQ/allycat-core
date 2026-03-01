<template>
  <div>
    <img src="hero.png">
    <button>×</button>
    <a href="https://example.com">click here</a>
    <input type="text">
    <h1>Page Title</h1>
    <h3>Skipped heading level</h3>
    <div @click="doSomething" role="button">Clickable div</div>
    <p :aria-label="'Paragraph label'">Some text {{ dynamicContent }}</p>
  </div>
</template>

<script>
export default {
  name: 'SampleComponent',
  data() {
    return { dynamicContent: 'hello' };
  },
  methods: {
    doSomething() {}
  }
}
</script>

<style scoped>
div { color: red; }
</style>
