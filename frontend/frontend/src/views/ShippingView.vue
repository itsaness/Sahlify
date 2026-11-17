<script setup>
import { ref, watch, onMounted } from 'vue'
import { apiFetch } from '../lib/api.js'

const props = defineProps({
  storeId: {
    type: String,
    required: true,
  },
})

const activeTab = ref('shipments')
const shipments = ref([])
const wilayas = ref([])
const rates = ref([])
const carrierCode = ref('manual')
const bulkHome = ref(600)
const bulkStopdesk = ref(400)

const loading = ref(false)
const syncing = ref(false)
const savingRates = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const SHIPMENT_STATUSES = [
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'failed_attempt',
  'returning',
  'returned',
  'cancelled',
]

async function loadShipments() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await apiFetch(`/api/stores/${props.storeId}/shipments`)
    shipments.value = data?.shipments || []
  } catch (err) {
    errorMsg.value = err.message || 'Failed to load shipments'
  } finally {
    loading.value = false
  }
}

async function loadWilayas() {
  if (wilayas.value.length > 0) return
  try {
    const data = await apiFetch('/api/wilayas')
    wilayas.value = data?.wilayas || []
    rates.value = wilayas.value.map((w) => ({
      wilayaId: w.id,
      code: w.code,
      nameFr: w.name_fr,
      nameAr: w.name_ar,
      homePriceDzd: 600,
      stopdeskPriceDzd: 400,
    }))
  } catch (err) {
    errorMsg.value = err.message || 'Failed to load wilayas'
  }
}

async function syncShipments() {
  syncing.value = true
  errorMsg.value = ''
  try {
    const res = await apiFetch(`/api/stores/${props.storeId}/shipments/sync`, { method: 'POST' })
    successMsg.value = `Synced ${res?.checked ?? 0} shipments (${res?.updated ?? 0} updated).`
    await loadShipments()
  } catch (err) {
    errorMsg.value = err.message || 'Sync failed'
  } finally {
    syncing.value = false
  }
}

async function updateStatus(shipmentId, nextStatus) {
  errorMsg.value = ''
  try {
    await apiFetch(`/api/stores/${props.storeId}/shipments/${shipmentId}/status`, {
      method: 'PATCH',
      body: { status: nextStatus },
    })
    successMsg.value = `Shipment updated to "${nextStatus}".`
    await loadShipments()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to update shipment status'
  }
}

async function cancelShipment(shipmentId) {
  if (!confirm('Cancel this shipment?')) return
  try {
    await apiFetch(`/api/stores/${props.storeId}/shipments/${shipmentId}/cancel`, {
      method: 'POST',
    })
    successMsg.value = 'Shipment cancelled.'
    await loadShipments()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to cancel shipment'
  }
}

function applyBulkPrices() {
  for (const r of rates.value) {
    r.homePriceDzd = Number(bulkHome.value) || 0
    r.stopdeskPriceDzd = Number(bulkStopdesk.value) || 0
  }
}

async function saveRates() {
  savingRates.value = true
  errorMsg.value = ''
  try {
    const payload = {
      carrierCode: carrierCode.value.trim() || 'manual',
      rates: rates.value.map((r) => ({
        wilayaId: r.wilayaId,
        homePriceDzd: Number(r.homePriceDzd) || 0,
        stopdeskPriceDzd: Number(r.stopdeskPriceDzd) || 0,
      })),
    }
    const res = await apiFetch(`/api/stores/${props.storeId}/shipping-rates`, {
      method: 'PUT',
      body: payload,
    })
    successMsg.value = `Saved shipping rates for ${res?.updated ?? 69} wilayas.`
  } catch (err) {
    errorMsg.value = err.message || 'Failed to save shipping rates'
  } finally {
    savingRates.value = false
  }
}

onMounted(() => {
  loadShipments()
  loadWilayas()
})
watch(() => props.storeId, loadShipments)
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Shipping &amp; 69-Wilaya Rates</h1>
        <p class="text-muted">Track carrier deliveries and configure delivery fees per wilaya.</p>
      </div>
    </div>

    <div class="tabs">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'shipments' }"
        @click="activeTab = 'shipments'"
      >
        Shipments ({{ shipments.length }})
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'rates' }"
        @click="activeTab = 'rates'"
      >
        69-Wilaya Rates
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <!-- Shipments Tab -->
    <div v-if="activeTab === 'shipments'" class="card stack">
      <div class="row-between">
        <h3>Active &amp; Past Shipments</h3>
        <button
          type="button"
          class="btn btn-primary btn-sm"
          :disabled="syncing"
          @click="syncShipments"
        >
          {{ syncing ? 'Syncing...' : 'Sync Carrier Statuses' }}
        </button>
      </div>

      <div v-if="loading" class="empty-state">Loading shipments...</div>
      <div v-else-if="shipments.length === 0" class="empty-state">
        No shipments yet. Dispatch an order from the Orders page.
      </div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Carrier</th>
              <th>Tracking</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in shipments" :key="s.id">
              <td class="mono">#{{ s.order_number }}</td>
              <td>
                <div>{{ s.customer_name }}</div>
                <div class="text-sm text-muted mono">{{ s.phone }}</div>
              </td>
              <td>{{ s.carrier_name }}</td>
              <td class="mono text-sm">{{ s.tracking_number || 'Manual' }}</td>
              <td>
                <select
                  class="select"
                  :value="s.status"
                  style="width: auto; padding: 0.25rem 0.5rem"
                  @change="updateStatus(s.id, $event.target.value)"
                >
                  <option v-for="st in SHIPMENT_STATUSES" :key="st" :value="st">
                    {{ st }}
                  </option>
                </select>
              </td>
              <td>
                <button
                  v-if="!['delivered', 'returned', 'cancelled'].includes(s.status)"
                  type="button"
                  class="btn btn-danger btn-sm"
                  @click="cancelShipment(s.id)"
                >
                  Cancel
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 69-Wilaya Rates Tab -->
    <div v-else class="card stack">
      <div class="row-between">
        <div class="row">
          <div class="form-group">
            <label class="label">Carrier Code</label>
            <input v-model="carrierCode" type="text" class="input mono" style="width: 140px" />
          </div>
          <div class="form-group">
            <label class="label">Bulk Home (DZD)</label>
            <input v-model="bulkHome" type="number" class="input" min="0" style="width: 120px" />
          </div>
          <div class="form-group">
            <label class="label">Bulk Stopdesk (DZD)</label>
            <input v-model="bulkStopdesk" type="number" class="input" min="0" style="width: 120px" />
          </div>
          <button
            type="button"
            class="btn btn-secondary btn-sm"
            style="align-self: flex-end"
            @click="applyBulkPrices"
          >
            Apply to All 69
          </button>
        </div>

        <button
          type="button"
          class="btn btn-primary"
          :disabled="savingRates"
          @click="saveRates"
        >
          {{ savingRates ? 'Saving...' : 'Save All Rates' }}
        </button>
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Wilaya</th>
              <th>Home Delivery (DZD)</th>
              <th>Stopdesk (DZD)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in rates" :key="r.wilayaId">
              <td class="mono">{{ r.code }}</td>
              <td>{{ r.nameFr }} — {{ r.nameAr }}</td>
              <td>
                <input
                  v-model="r.homePriceDzd"
                  type="number"
                  class="input"
                  min="0"
                  style="max-width: 140px"
                />
              </td>
              <td>
                <input
                  v-model="r.stopdeskPriceDzd"
                  type="number"
                  class="input"
                  min="0"
                  style="max-width: 140px"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
