<script setup>
import { useI18n } from '../composables/useI18n.js'

const { lang, setLang } = useI18n()

function onChange(event) {
  setLang(event.target.value)
}
</script>

<template>
  <select
    class="select lang-select"
    :value="lang"
    aria-label="Language"
    @change="onChange"
  >
    <option value="en">EN</option>
    <option value="fr">FR</option>
    <option value="ar">AR</option>
  </select>
</template>

<style scoped>
.lang-select {
  width: auto;
  padding: 0.32rem 0.55rem;
  font-size: 0.82rem;
  font-weight: 600;
}
</style>
