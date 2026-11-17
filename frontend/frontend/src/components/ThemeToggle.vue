<script setup>
import { useTheme } from '../composables/useTheme.js'
import { useI18n } from '../composables/useI18n.js'

const { theme, toggleTheme } = useTheme()
const { t } = useI18n()
</script>

<template>
  <button
    type="button"
    class="btn btn-secondary btn-sm theme-toggle-btn"
    :aria-label="theme === 'dark' ? t.theme.toLight : t.theme.toDark"
    :title="theme === 'dark' ? t.theme.toLight : t.theme.toDark"
    @click="toggleTheme"
  >
    <span v-if="theme === 'dark'" class="theme-icon" aria-hidden="true">☀️</span>
    <span v-else class="theme-icon" aria-hidden="true">🌙</span>
    <span>{{ theme === 'dark' ? t.theme.light : t.theme.dark }}</span>
  </button>
</template>

<style scoped>
.theme-toggle-btn {
  gap: 0.4rem;
}
.theme-icon {
  font-size: 0.95rem;
  line-height: 1;
}
</style>
