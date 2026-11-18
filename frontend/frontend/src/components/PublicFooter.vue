<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from '../composables/useI18n.js'

const router = useRouter()
const navigate = (to) => router.push(to)
const { t } = useI18n()
</script>

<template>
  <footer class="public-footer">
    <div class="container row-between">
      <span class="text-sm text-muted">{{ t.landing.footerText }}</span>
      <div class="row text-sm">
        <a href="/docs" @click.prevent="navigate('/docs')">{{ t.nav.docs }}</a>
        <a href="/pricing" @click.prevent="navigate('/pricing')">{{ t.nav.pricing }}</a>
        <a href="/terms" @click.prevent="navigate('/terms')">{{ t.nav.terms }}</a>
        <a href="/privacy" @click.prevent="navigate('/privacy')">{{ t.nav.privacy }}</a>
        <a href="/contact" @click.prevent="navigate('/contact')">{{ t.nav.contact }}</a>
        <a href="/auth" @click.prevent="navigate('/auth')">{{ t.landing.merchantSignIn }}</a>
        <a
          href="https://github.com/itsaness/Sahlify"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="GitHub"
          title="GitHub"
          style="display: inline-flex; align-items: center"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path
              d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
            />
          </svg>
        </a>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.public-footer {
  border-top: 1px solid var(--border);
  background: var(--surface);
  padding: 1.5rem 0;
  margin-top: auto;
}

@media (max-width: 640px) {
  .public-footer .row-between {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
