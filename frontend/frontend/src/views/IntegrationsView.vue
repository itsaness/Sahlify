<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { apiFetch } from '../lib/api.js'

const props = defineProps({
  storeId: {
    type: String,
    required: true,
  },
})

const activeTab = ref('carriers')
const carriers = ref([])
const integrations = ref([])
const capiEvents = ref([])
const capiSummary = ref({ sent: 0, failed: 0, pending: 0, expired: 0 })

const errorMsg = ref('')
const successMsg = ref('')
const testingCode = ref('')

// Carrier form
const selectedCarrierCode = ref('yalidine')
const carrierCreds = ref({})
const carrierIsDefault = ref(true)
const carrierIsActive = ref(true)

// Chargily form
const chargilyForm = ref({ apiKey: '', mode: 'test', isActive: true })

// Meta CAPI form
const metaForm = ref({ pixelId: '', accessToken: '', testEventCode: '', isActive: true })

const selectedCarrierObj = computed(() =>
  carriers.value.find((c) => c.code === selectedCarrierCode.value) || null
)

watch(selectedCarrierCode, () => {
  carrierCreds.value = {}
})

async function loadAll() {
  errorMsg.value = ''
  try {
    const [carData, intData, capiData] = await Promise.all([
      apiFetch('/api/carriers'),
      apiFetch(`/api/stores/${props.storeId}/integrations`),
      apiFetch(`/api/stores/${props.storeId}/capi/events`).catch(() => ({ events: [], summary: {} })),
    ])
    carriers.value = (carData?.carriers || []).filter((c) => c.code !== 'manual')
    integrations.value = intData?.integrations || []
    capiEvents.value = capiData?.events || []
    capiSummary.value = capiData?.summary || { sent: 0, failed: 0, pending: 0, expired: 0 }
  } catch (err) {
    errorMsg.value = err.message || 'Failed to load integrations'
  }
}

async function saveCarrier() {
  errorMsg.value = ''
  successMsg.value = ''
  try {
    await apiFetch(
      `/api/stores/${props.storeId}/integrations/carrier/${selectedCarrierCode.value}`,
      {
        method: 'PUT',
        body: {
          credentials: carrierCreds.value,
          isDefault: carrierIsDefault.value,
          isActive: carrierIsActive.value,
        },
      }
    )
    successMsg.value = `Saved ${selectedCarrierCode.value} integration.`
    carrierCreds.value = {}
    await loadAll()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to save carrier integration'
  }
}

async function testCarrier(carrierCode) {
  testingCode.value = carrierCode
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const res = await apiFetch(
      `/api/stores/${props.storeId}/integrations/carrier/${carrierCode}/test`,
      { method: 'POST' }
    )
    if (res?.ok === false) {
      errorMsg.value = res.message || `Test failed for ${carrierCode}`
    } else {
      successMsg.value = `Credentials verified for ${carrierCode}!`
    }
  } catch (err) {
    errorMsg.value = err.message || `Test failed for ${carrierCode}`
  } finally {
    testingCode.value = ''
  }
}

async function saveChargily() {
  errorMsg.value = ''
  successMsg.value = ''
  try {
    await apiFetch(`/api/stores/${props.storeId}/integrations/chargily`, {
      method: 'PUT',
      body: chargilyForm.value,
    })
    successMsg.value = 'Chargily Pay configuration saved.'
    chargilyForm.value.apiKey = ''
    await loadAll()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to save Chargily integration'
  }
}

async function saveMeta() {
  errorMsg.value = ''
  successMsg.value = ''
  try {
    await apiFetch(`/api/stores/${props.storeId}/integrations/meta`, {
      method: 'PUT',
      body: metaForm.value,
    })
    successMsg.value = 'Meta Pixel & CAPI configuration saved.'
    metaForm.value.accessToken = ''
    await loadAll()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to save Meta integration'
  }
}

async function deleteIntegration(integrationId) {
  if (!confirm('Remove this integration?')) return
  try {
    await apiFetch(`/api/stores/${props.storeId}/integrations/${integrationId}`, {
      method: 'DELETE',
    })
    await loadAll()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to delete integration'
  }
}

async function retryCapi(eventId) {
  try {
    await apiFetch(`/api/stores/${props.storeId}/capi/events/${eventId}/retry`, {
      method: 'POST',
    })
    successMsg.value = 'CAPI event retried.'
    await loadAll()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to retry CAPI event'
  }
}

onMounted(loadAll)
watch(() => props.storeId, loadAll)
</script>

<template>
  <div class="stack">
    <div>
      <h1>Integrations &amp; Meta CAPI</h1>
      <p class="text-muted">
        Connect Algerian express carriers, Chargily Pay (DZD), and Meta Conversions API.
      </p>
    </div>

    <div class="tabs">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'carriers' }"
        @click="activeTab = 'carriers'"
      >
        Express Carriers
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'payments' }"
        @click="activeTab = 'payments'"
      >
        Chargily Pay (DZD)
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'capi' }"
        @click="activeTab = 'capi'"
      >
        Meta CAPI &amp; Logs
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <!-- Configured Integrations Summary -->
    <div v-if="integrations.length > 0" class="card stack-sm">
      <h3>Connected Integrations</h3>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Provider</th>
              <th>Credentials</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in integrations" :key="item.id">
              <td>
                <strong>{{ item.carrier_name || item.provider.toUpperCase() }}</strong>
                <span v-if="item.is_default" class="badge badge-primary" style="margin-left: 0.4rem">
                  Default
                </span>
              </td>
              <td class="mono text-sm text-muted">
                {{ JSON.stringify(item.credentials_masked) }}
              </td>
              <td>
                <span class="badge" :class="item.is_active ? 'badge-success' : 'badge-warning'">
                  {{ item.is_active ? 'Active' : 'Inactive' }}
                </span>
              </td>
              <td>
                <div class="row">
                  <button
                    v-if="item.provider === 'carrier' && item.carrier_code"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    :disabled="testingCode === item.carrier_code"
                    @click="testCarrier(item.carrier_code)"
                  >
                    {{ testingCode === item.carrier_code ? 'Testing...' : 'Test' }}
                  </button>
                  <button
                    type="button"
                    class="btn btn-danger btn-sm"
                    @click="deleteIntegration(item.id)"
                  >
                    Remove
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Carriers Tab -->
    <div v-if="activeTab === 'carriers'" class="card stack">
      <h3>Connect an Algerian Express Carrier</h3>
      <form class="stack" @submit.prevent="saveCarrier">
        <div class="form-group">
          <label class="label">Carrier</label>
          <select v-model="selectedCarrierCode" class="select">
            <option v-for="c in carriers" :key="c.code" :value="c.code">
              {{ c.name }} ({{ c.platform }})
            </option>
          </select>
        </div>

        <template v-if="selectedCarrierObj">
          <div
            v-for="field in selectedCarrierObj.credential_fields"
            :key="field"
            class="form-group"
          >
            <label class="label mono">{{ field }}</label>
            <input
              v-model="carrierCreds[field]"
              type="password"
              class="input mono"
              :placeholder="`Enter ${field}`"
              required
            />
          </div>
        </template>

        <div class="row">
          <label class="checkbox-row">
            <input v-model="carrierIsDefault" type="checkbox" />
            <span>Set as default carrier</span>
          </label>
          <label class="checkbox-row">
            <input v-model="carrierIsActive" type="checkbox" />
            <span>Active</span>
          </label>
        </div>

        <div>
          <button type="submit" class="btn btn-primary">Save Carrier Credentials</button>
        </div>
      </form>
    </div>

    <!-- Chargily Tab -->
    <div v-if="activeTab === 'payments'" class="card stack">
      <h3>Chargily Pay V2 (Edahabia &amp; CIB)</h3>
      <form class="stack" @submit.prevent="saveChargily">
        <div class="form-group">
          <label class="label">Chargily Secret API Key</label>
          <input
            v-model="chargilyForm.apiKey"
            type="password"
            class="input mono"
            placeholder="test_sk_... or live_sk_..."
            required
          />
        </div>

        <div class="form-group">
          <label class="label">Mode</label>
          <select v-model="chargilyForm.mode" class="select" style="max-width: 220px">
            <option value="test">Test (Sandbox)</option>
            <option value="live">Live (Production)</option>
          </select>
        </div>

        <label class="checkbox-row">
          <input v-model="chargilyForm.isActive" type="checkbox" />
          <span>Active</span>
        </label>

        <div>
          <button type="submit" class="btn btn-primary">Save Chargily Settings</button>
        </div>
      </form>
    </div>

    <!-- Meta CAPI Tab -->
    <div v-if="activeTab === 'capi'" class="stack">
      <div class="card stack">
        <h3>Meta Pixel &amp; Conversions API (CAPI)</h3>
        <form class="stack" @submit.prevent="saveMeta">
          <div class="grid-2">
            <div class="form-group">
              <label class="label">Meta Pixel ID</label>
              <input v-model="metaForm.pixelId" type="text" class="input mono" required />
            </div>
            <div class="form-group">
              <label class="label">Test Event Code (optional)</label>
              <input v-model="metaForm.testEventCode" type="text" class="input mono" placeholder="TEST12345" />
            </div>
          </div>

          <div class="form-group">
            <label class="label">Conversions API Access Token</label>
            <input v-model="metaForm.accessToken" type="password" class="input mono" required />
          </div>

          <label class="checkbox-row">
            <input v-model="metaForm.isActive" type="checkbox" />
            <span>Enable server-side Lead &amp; Purchase tracking</span>
          </label>

          <div>
            <button type="submit" class="btn btn-primary">Save Meta CAPI</button>
          </div>
        </form>
      </div>

      <div class="card stack">
        <div class="row-between">
          <h3>CAPI Event Logs</h3>
          <div class="row text-sm">
            <span class="badge badge-success">Sent: {{ capiSummary.sent || 0 }}</span>
            <span class="badge badge-warning">Pending: {{ capiSummary.pending || 0 }}</span>
            <span class="badge badge-danger">Failed: {{ capiSummary.failed || 0 }}</span>
          </div>
        </div>

        <div v-if="capiEvents.length === 0" class="empty-state">No CAPI events recorded yet.</div>
        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Event</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Last Error</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="ev in capiEvents" :key="ev.id">
                <td class="mono">#{{ ev.order_number }}</td>
                <td><strong>{{ ev.event_name }}</strong></td>
                <td>
                  <span
                    class="badge"
                    :class="{
                      'badge-success': ev.status === 'sent',
                      'badge-warning': ev.status === 'pending',
                      'badge-danger': ev.status === 'failed' || ev.status === 'expired',
                    }"
                  >
                    {{ ev.status }}
                  </span>
                </td>
                <td>{{ ev.attempts }}</td>
                <td class="text-sm text-muted">{{ ev.last_error || '—' }}</td>
                <td>
                  <button
                    v-if="ev.status !== 'sent'"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="retryCapi(ev.id)"
                  >
                    Retry
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
