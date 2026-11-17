<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../lib/api.js'

const emit = defineEmits(['stores-updated'])
const router = useRouter()
const navigate = (to) => router.push(to)

const stores = ref([])
const loading = ref(false)
const errorMsg = ref('')

const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
const form = ref({
  name: '',
  slug: '',
  language: 'ar',
  customDomain: '',
})

function autoSlug() {
  if (!form.value.slug && form.value.name) {
    form.value.slug = form.value.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48)
  }
}

async function fetchStores() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await apiFetch('/api/stores')
    stores.value = data?.stores || []
  } catch (err) {
    errorMsg.value = err.message || 'Could not load stores'
  } finally {
    loading.value = false
  }
}

async function handleCreateStore() {
  createError.value = ''
  creating.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      slug: form.value.slug.trim().toLowerCase(),
      language: form.value.language,
      customDomain: form.value.customDomain.trim() ? form.value.customDomain.trim().toLowerCase() : null,
    }
    const data = await apiFetch('/api/stores', { method: 'POST', body: payload })
    showCreateModal.value = false
    form.value = { name: '', slug: '', language: 'ar', customDomain: '' }
    await fetchStores()
    emit('stores-updated')
    if (data?.store?.id) {
      navigate(`/stores/${data.store.id}/products`)
    }
  } catch (err) {
    createError.value = err.message || 'Failed to create store'
  } finally {
    creating.value = false
  }
}

onMounted(fetchStores)
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>My Stores</h1>
        <p class="text-muted">Select a store to manage products, orders, carriers, and themes.</p>
      </div>
      <button type="button" class="btn btn-primary" @click="showCreateModal = true">
        + Create Store
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>

    <div v-if="loading" class="card empty-state">Loading your stores...</div>

    <div v-else-if="stores.length === 0" class="card empty-state stack-sm">
      <h3>No stores yet</h3>
      <p>Create your first store to start adding products and receiving orders.</p>
      <div>
        <button type="button" class="btn btn-primary" @click="showCreateModal = true">
          Create Your First Store
        </button>
      </div>
    </div>

    <div v-else class="grid-2">
      <div v-for="store in stores" :key="store.id" class="card stack">
        <div class="row-between">
          <div>
            <h3>{{ store.name }}</h3>
            <span class="text-sm text-muted mono">{{ store.slug }}</span>
          </div>
          <span
            class="badge"
            :class="{
              'badge-success': store.status === 'active',
              'badge-warning': store.status === 'draft',
              'badge-danger': store.status === 'suspended',
            }"
          >
            {{ store.status }}
          </span>
        </div>

        <div class="row text-sm">
          <span class="badge">Lang: {{ store.language.toUpperCase() }}</span>
          <span v-if="store.cod_enabled" class="badge badge-success">COD</span>
          <span v-if="store.online_payment_enabled" class="badge badge-primary">Chargily DZD</span>
          <span v-if="store.capi_enabled" class="badge badge-primary">Meta CAPI</span>
        </div>

        <div class="row">
          <button
            type="button"
            class="btn btn-primary btn-sm"
            @click="navigate(`/stores/${store.id}/products`)"
          >
            Products
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="navigate(`/stores/${store.id}/orders`)"
          >
            Orders
          </button>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            @click="navigate(`/stores/${store.id}/themes`)"
          >
            Themes &amp; AI
          </button>
          <button
            type="button"
            class="btn btn-ghost btn-sm"
            @click="navigate(`/stores/${store.id}/settings`)"
          >
            Settings
          </button>
        </div>
      </div>
    </div>

    <!-- Create Store Modal -->
    <div v-if="showCreateModal" class="modal-backdrop" @click.self="showCreateModal = false">
      <div class="modal-card stack">
        <div class="row-between">
          <h3>Create a New Store</h3>
          <button type="button" class="btn btn-ghost btn-sm" @click="showCreateModal = false">
            ✕
          </button>
        </div>

        <div v-if="createError" class="alert alert-error">{{ createError }}</div>

        <form class="stack" @submit.prevent="handleCreateStore">
          <div class="form-group">
            <label class="label">Store Name</label>
            <input
              v-model="form.name"
              type="text"
              class="input"
              placeholder="Atlas Mode DZ"
              required
              minlength="2"
              @blur="autoSlug"
            />
          </div>

          <div class="form-group">
            <label class="label">Store Slug (subdomain)</label>
            <input
              v-model="form.slug"
              type="text"
              class="input mono"
              placeholder="atlas-mode-dz"
              required
              minlength="3"
            />
            <span class="hint">3-50 lowercase letters, numbers, or hyphens.</span>
          </div>

          <div class="form-group">
            <label class="label">Default Storefront Language</label>
            <select v-model="form.language" class="select">
              <option value="ar">Arabic (RTL)</option>
              <option value="fr">French (LTR)</option>
              <option value="en">English (LTR)</option>
            </select>
          </div>

          <div class="form-group">
            <label class="label">Custom Domain (Optional)</label>
            <input
              v-model="form.customDomain"
              type="text"
              class="input mono"
              placeholder="shop.example.dz"
            />
          </div>

          <div class="row-between">
            <button type="button" class="btn btn-secondary" @click="showCreateModal = false">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="creating">
              {{ creating ? 'Creating...' : 'Create Store' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
