<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useI18n } from '../composables/useI18n.js'
import { usePlatformInfo, apiFetch } from '../lib/api.js'
import ThemeToggle from './ThemeToggle.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'

const props = defineProps({
  storeId: {
    type: String,
    default: null,
  },
  activeSection: {
    type: String,
    default: 'stores',
  },
})

const route = useRoute()
const router = useRouter()
const path = computed(() => route.path)
const navigate = (to) => router.push(to)
const { user, signOut } = useAuth()
const { t } = useI18n()
const { deploymentMode } = usePlatformInfo()

const stores = ref([])
const currentStore = computed(() => stores.value.find((s) => s.id === props.storeId) || null)

async function loadStores() {
  try {
    const data = await apiFetch('/api/stores')
    stores.value = data?.stores || []
  } catch {
    stores.value = []
  }
}

onMounted(loadStores)
watch(() => props.storeId, loadStores)

function onStoreChange(event) {
  const nextId = event.target.value
  if (!nextId) {
    navigate('/dashboard')
  } else {
    const sec = props.activeSection && props.activeSection !== 'stores' ? props.activeSection : 'products'
    navigate(`/stores/${nextId}/${sec}`)
  }
}

async function handleSignOut() {
  await signOut()
  navigate('/')
}

const navItems = computed(() => {
  if (!props.storeId) return []
  const base = `/stores/${props.storeId}`
  const items = [
    { key: 'products', label: t.value.sidebar.products, to: `${base}/products` },
    { key: 'orders', label: t.value.sidebar.orders, to: `${base}/orders` },
    { key: 'shipping', label: t.value.sidebar.shipping, to: `${base}/shipping` },
    { key: 'themes', label: t.value.sidebar.themes, to: `${base}/themes` },
    { key: 'integrations', label: t.value.sidebar.integrations, to: `${base}/integrations` },
  ]
  if (deploymentMode.value === 'cloud') {
    items.push({ key: 'billing', label: t.value.sidebar.billing, to: `${base}/billing` })
  }
  items.push({ key: 'settings', label: t.value.sidebar.settings, to: `${base}/settings` })
  return items
})
</script>

<template>
  <div class="dashboard-shell">
    <header class="dash-topbar">
      <div class="dash-topbar-left">
        <a href="/" class="brand" @click.prevent="navigate('/')">
          <img src="/sahlify.webp" alt="Sahlify" class="brand-logo" />
        </a>

        <span class="divider">/</span>

        <button
          type="button"
          class="btn btn-ghost btn-sm"
          :class="{ 'active-top': path === '/dashboard' }"
          @click="navigate('/dashboard')"
        >
          {{ t.nav.myStores }}
        </button>

        <template v-if="stores.length > 0">
          <select
            class="select store-switcher"
            :value="storeId || ''"
            aria-label="Switch Store"
            @change="onStoreChange"
          >
            <option value="">{{ t.nav.selectStore }}</option>
            <option v-for="s in stores" :key="s.id" :value="s.id">
              {{ s.name }} ({{ s.slug }})
            </option>
          </select>
        </template>

        <span
          v-if="currentStore"
          class="badge"
          :class="{
            'badge-success': currentStore.status === 'active',
            'badge-warning': currentStore.status === 'draft',
            'badge-danger': currentStore.status === 'suspended',
          }"
        >
          {{ currentStore.status }}
        </span>
      </div>

      <div class="dash-topbar-right">
        <span class="badge badge-primary">
          {{ deploymentMode === 'self_hosted' ? t.landing.selfHost : t.landing.cloud }}
        </span>
        <button
          v-if="deploymentMode === 'cloud'"
          type="button"
          class="btn btn-ghost btn-sm"
          @click="navigate('/admin')"
        >
          {{ t.nav.admin }}
        </button>
        <LanguageSwitcher />
        <ThemeToggle />
        <span v-if="user?.email" class="user-email text-sm text-muted">{{ user.email }}</span>
        <button type="button" class="btn btn-secondary btn-sm" @click="handleSignOut">
          {{ t.nav.signOut }}
        </button>
      </div>
    </header>

    <div class="dash-body">
      <aside v-if="storeId" class="dash-sidebar">
        <div v-if="currentStore" class="sidebar-store-card">
          <div class="sidebar-store-name">{{ currentStore.name }}</div>
          <div class="text-sm text-muted mono">{{ currentStore.slug }}</div>
        </div>

        <nav class="sidebar-nav" aria-label="Store Management">
          <a
            v-for="item in navItems"
            :key="item.key"
            :href="item.to"
            class="sidebar-link"
            :class="{ active: activeSection === item.key }"
            @click.prevent="navigate(item.to)"
          >
            {{ item.label }}
          </a>
        </nav>

        <div class="sidebar-footer">
          <a href="/docs" class="text-sm text-muted" @click.prevent="navigate('/docs')">
            {{ t.nav.documentation }}
          </a>
        </div>
      </aside>

      <main class="dash-main">
        <slot :reload-stores="loadStores" :current-store="currentStore" />
      </main>
    </div>
  </div>
</template>

<style scoped>
.dashboard-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.dash-topbar {
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  padding: 0.65rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.dash-topbar-left,
.dash-topbar-right {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  flex-wrap: wrap;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 800;
  color: var(--heading);
  text-decoration: none;
}

.brand-logo {
  height: 34px;
  width: auto;
  display: block;
  object-fit: contain;
}

.divider {
  color: var(--border-strong);
}

.store-switcher {
  width: auto;
  min-width: 190px;
  padding: 0.35rem 0.65rem;
  font-size: 0.85rem;
}

.active-top {
  color: var(--primary);
  background: var(--primary-soft);
}

.dash-body {
  flex: 1;
  display: flex;
  min-height: calc(100vh - 57px);
}

.dash-sidebar {
  width: 230px;
  flex-shrink: 0;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 1.1rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.sidebar-store-card {
  padding: 0.65rem 0.75rem;
  background: var(--bg-soft);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
}

.sidebar-store-name {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--heading);
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  flex: 1;
}

.sidebar-link {
  padding: 0.55rem 0.75rem;
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  font-weight: 600;
  font-size: 0.9rem;
  text-decoration: none;
}

.sidebar-link:hover {
  background: var(--bg-soft);
  color: var(--text);
  text-decoration: none;
}

.sidebar-link.active {
  background: var(--primary-soft);
  color: var(--primary);
}

.sidebar-footer {
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.dash-main {
  flex: 1;
  padding: 1.75rem 1.5rem;
  max-width: 1120px;
  width: 100%;
  margin: 0 auto;
}

@media (max-width: 768px) {
  .dash-topbar {
    padding: 0.6rem 0.9rem;
    gap: 0.6rem;
  }
  .dash-topbar-left,
  .dash-topbar-right {
    width: 100%;
    justify-content: space-between;
  }
  .store-switcher {
    flex: 1;
    min-width: 140px;
  }
  .dash-body {
    flex-direction: column;
  }
  .dash-sidebar {
    width: 100%;
    padding: 0.75rem 0.9rem;
    border-right: none;
    border-bottom: 1px solid var(--border);
    gap: 0.65rem;
  }
  .sidebar-nav {
    flex-direction: row;
    overflow-x: auto;
    padding-bottom: 0.2rem;
  }
  .sidebar-link {
    white-space: nowrap;
  }
  .sidebar-footer {
    display: none;
  }
  .dash-main {
    padding: 1.1rem 0.9rem;
  }
  .user-email {
    display: none;
  }
}
</style>
