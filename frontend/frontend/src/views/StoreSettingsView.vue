<script setup>
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { apiFetch } from '../lib/api.js'

const props = defineProps({
  storeId: {
    type: String,
    required: true,
  },
})

const emit = defineEmits(['stores-updated'])
const router = useRouter()

const store = ref(null)
const loading = ref(false)
const saving = ref(false)
const verifying = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const form = ref({
  name: '',
  slug: '',
  language: 'ar',
  customDomain: '',
  codEnabled: true,
  onlinePaymentEnabled: false,
  capiEnabled: false,
  status: 'active',
})

async function loadStore() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await apiFetch(`/api/stores/${props.storeId}`)
    store.value = data?.store || null
    if (store.value) {
      form.value = {
        name: store.value.name,
        slug: store.value.slug,
        language: store.value.language,
        customDomain: store.value.custom_domain || '',
        codEnabled: Boolean(store.value.cod_enabled),
        onlinePaymentEnabled: Boolean(store.value.online_payment_enabled),
        capiEnabled: Boolean(store.value.capi_enabled),
        status: store.value.status === 'draft' ? 'draft' : 'active',
      }
    }
  } catch (err) {
    errorMsg.value = err.message || 'Failed to load store settings'
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  saving.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const payload = {
      name: form.value.name.trim(),
      slug: form.value.slug.trim().toLowerCase(),
      language: form.value.language,
      customDomain: form.value.customDomain.trim()
        ? form.value.customDomain.trim().toLowerCase()
        : null,
      codEnabled: form.value.codEnabled,
      onlinePaymentEnabled: form.value.onlinePaymentEnabled,
      capiEnabled: form.value.capiEnabled,
      status: form.value.status,
    }
    const data = await apiFetch(`/api/stores/${props.storeId}`, {
      method: 'PATCH',
      body: payload,
    })
    store.value = data?.store
    successMsg.value = 'Store settings saved.'
    emit('stores-updated')
  } catch (err) {
    errorMsg.value = err.message || 'Failed to save settings'
  } finally {
    saving.value = false
  }
}

async function verifyDomain() {
  verifying.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const res = await apiFetch(`/api/stores/${props.storeId}/verify-domain`, { method: 'POST' })
    if (res?.verified) {
      successMsg.value = `Custom domain ${res.domain} verified!`
      await loadStore()
    } else {
      errorMsg.value = res?.message || 'Domain verification failed'
    }
  } catch (err) {
    errorMsg.value = err.message || 'Domain verification failed'
  } finally {
    verifying.value = false
  }
}

async function deleteStore() {
  if (!confirm(`Permanently delete store "${store.value?.name}"? This cannot be undone.`)) return
  try {
    await apiFetch(`/api/stores/${props.storeId}`, { method: 'DELETE' })
    emit('stores-updated')
    router.push('/dashboard')
  } catch (err) {
    errorMsg.value = err.message || 'Failed to delete store'
  }
}

onMounted(loadStore)
watch(() => props.storeId, loadStore)
</script>

<template>
  <div class="stack">
    <div>
      <h1>Store Settings</h1>
      <p class="text-muted">Configure store details, payment methods, and custom domain DNS.</p>
    </div>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <div v-if="loading" class="card empty-state">Loading settings...</div>

    <template v-else-if="store">
      <form class="card stack" @submit.prevent="saveSettings">
        <div class="grid-2">
          <div class="form-group">
            <label class="label">Store Name</label>
            <input v-model="form.name" type="text" class="input" required minlength="2" />
          </div>
          <div class="form-group">
            <label class="label">Slug</label>
            <input v-model="form.slug" type="text" class="input mono" required minlength="3" />
          </div>
        </div>

        <div class="grid-2">
          <div class="form-group">
            <label class="label">Language</label>
            <select v-model="form.language" class="select">
              <option value="ar">Arabic (RTL)</option>
              <option value="fr">French (LTR)</option>
              <option value="en">English (LTR)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="label">Store Status</label>
            <select v-model="form.status" class="select">
              <option value="active">Active</option>
              <option value="draft">Draft</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="label">Custom Domain</label>
          <div class="row">
            <input
              v-model="form.customDomain"
              type="text"
              class="input mono"
              placeholder="shop.example.dz"
              style="flex: 1"
            />
            <button
              v-if="store.custom_domain"
              type="button"
              class="btn btn-secondary"
              :disabled="verifying"
              @click="verifyDomain"
            >
              {{ verifying ? 'Verifying...' : 'Verify DNS' }}
            </button>
          </div>
          <span v-if="store.custom_domain_token" class="hint mono">
            Add TXT record at _sahlify.{{ store.custom_domain }} → {{ store.custom_domain_token }}
          </span>
        </div>

        <div class="stack-sm">
          <label class="checkbox-row">
            <input v-model="form.codEnabled" type="checkbox" />
            <span>Enable Cash on Delivery (COD)</span>
          </label>
          <label class="checkbox-row">
            <input v-model="form.onlinePaymentEnabled" type="checkbox" />
            <span>Enable Online Payment (Chargily Edahabia / CIB)</span>
          </label>
          <label class="checkbox-row">
            <input v-model="form.capiEnabled" type="checkbox" />
            <span>Enable Meta Conversions API (CAPI)</span>
          </label>
        </div>

        <div>
          <button type="submit" class="btn btn-primary" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
        </div>
      </form>

      <div class="card row-between" style="border-color: var(--danger)">
        <div>
          <h3 style="color: var(--danger)">Danger Zone</h3>
          <p class="text-sm text-muted">Deleting this store removes all products and orders.</p>
        </div>
        <button type="button" class="btn btn-danger" @click="deleteStore">Delete Store</button>
      </div>
    </template>
  </div>
</template>
