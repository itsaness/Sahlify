<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useI18n } from '../composables/useI18n.js'
import ThemeToggle from './ThemeToggle.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'

const route = useRoute()
const router = useRouter()
const path = computed(() => route.path)
const navigate = (to) => router.push(to)
const { isAuthenticated, user, signOut } = useAuth()
const { t } = useI18n()

async function handleSignOut() {
  await signOut()
  navigate('/')
}
</script>

<template>
  <header class="public-navbar">
    <div class="container navbar-inner">
      <a href="/" class="brand" @click.prevent="navigate('/')">
        <img src="/sahlify.webp" alt="Sahlify" class="brand-logo" />
      </a>

      <nav class="nav-links" aria-label="Main Navigation">
        <a
          href="/"
          class="nav-link"
          :class="{ active: path === '/' }"
          @click.prevent="navigate('/')"
        >
          {{ t.nav.home }}
        </a>
        <a
          href="/docs"
          class="nav-link"
          :class="{ active: path === '/docs' }"
          @click.prevent="navigate('/docs')"
        >
          {{ t.nav.docs }}
        </a>
        <a
          href="/pricing"
          class="nav-link"
          :class="{ active: path === '/pricing' }"
          @click.prevent="navigate('/pricing')"
        >
          {{ t.nav.pricing }}
        </a>
      </nav>

      <div class="nav-actions">
        <LanguageSwitcher />
        <ThemeToggle />
        <template v-if="isAuthenticated">
          <button type="button" class="btn btn-primary btn-sm" @click="navigate('/dashboard')">
            {{ t.nav.dashboard }}
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            :title="user?.email"
            @click="handleSignOut"
          >
            {{ t.nav.signOut }}
          </button>
        </template>
        <template v-else>
          <button type="button" class="btn btn-primary btn-sm" @click="navigate('/auth')">
            {{ t.nav.signIn }}
          </button>
        </template>
      </div>
    </div>
  </header>
</template>

<style scoped>
.public-navbar {
  position: sticky;
  top: 0;
  z-index: 40;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}

.navbar-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 64px;
  gap: 1rem;
  flex-wrap: wrap;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  font-weight: 800;
  font-size: 1.15rem;
  color: var(--heading);
  text-decoration: none;
}

.brand:hover {
  text-decoration: none;
}

.brand-logo {
  height: 36px;
  width: auto;
  display: block;
  object-fit: contain;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.nav-link {
  padding: 0.4rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.92rem;
  text-decoration: none;
}

.nav-link:hover {
  color: var(--text);
  background: var(--bg-soft);
  text-decoration: none;
}

.nav-link.active {
  color: var(--primary);
  background: var(--primary-soft);
}

.nav-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

@media (max-width: 640px) {
  .navbar-inner {
    padding: 0.55rem 0;
    gap: 0.5rem;
  }

  .nav-links {
    order: 3;
    width: 100%;
    justify-content: center;
    padding-top: 0.45rem;
    border-top: 1px solid var(--border);
  }

  .nav-actions {
    gap: 0.4rem;
  }
}
</style>
