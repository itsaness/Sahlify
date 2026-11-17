<script setup>
import { ref, watch, onMounted } from 'vue'
import { apiFetch } from '../lib/api.js'

const props = defineProps({
  storeId: {
    type: String,
    required: true,
  },
})

const activeTab = ref('orders')
const orders = ref([])
const statusFilter = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// Order detail modal
const selectedOrder = ref(null)
const orderDetail = ref(null)
const shipCarrierCode = ref('')

// Blacklist
const blacklist = ref([])
const blacklistForm = ref({ phone: '', reason: '' })

async function loadOrders() {
  loading.value = true
  errorMsg.value = ''
  try {
    const qs = statusFilter.value ? `?status=${encodeURIComponent(statusFilter.value)}` : ''
    const data = await apiFetch(`/api/stores/${props.storeId}/orders${qs}`)
    orders.value = data?.orders || []
  } catch (err) {
    errorMsg.value = err.message || 'Failed to load orders'
  } finally {
    loading.value = false
  }
}

async function loadBlacklist() {
  try {
    const data = await apiFetch(`/api/stores/${props.storeId}/orders/blacklist`)
    blacklist.value = data?.blacklist || []
  } catch (err) {
    errorMsg.value = err.message || 'Failed to load blacklist'
  }
}

async function openOrder(order) {
  selectedOrder.value = order
  orderDetail.value = null
  try {
    orderDetail.value = await apiFetch(`/api/stores/${props.storeId}/orders/${order.id}`)
  } catch (err) {
    errorMsg.value = err.message || 'Failed to load order details'
  }
}

async function confirmOrder(orderId) {
  try {
    await apiFetch(`/api/stores/${props.storeId}/orders/${orderId}/confirm`, { method: 'POST' })
    successMsg.value = 'Order confirmed.'
    await loadOrders()
    if (selectedOrder.value?.id === orderId) await openOrder(selectedOrder.value)
  } catch (err) {
    errorMsg.value = err.message || 'Could not confirm order'
  }
}

async function cancelOrder(orderId) {
  try {
    await apiFetch(`/api/stores/${props.storeId}/orders/${orderId}/cancel`, { method: 'POST' })
    successMsg.value = 'Order cancelled.'
    await loadOrders()
    if (selectedOrder.value?.id === orderId) await openOrder(selectedOrder.value)
  } catch (err) {
    errorMsg.value = err.message || 'Could not cancel order'
  }
}

async function shipOrder(orderId) {
  errorMsg.value = ''
  try {
    const body = shipCarrierCode.value.trim()
      ? { carrierCode: shipCarrierCode.value.trim() }
      : {}
    await apiFetch(`/api/stores/${props.storeId}/orders/${orderId}/ship`, {
      method: 'POST',
      body,
    })
    successMsg.value = 'Shipment created and order marked shipped.'
    await loadOrders()
    if (selectedOrder.value?.id === orderId) await openOrder(selectedOrder.value)
  } catch (err) {
    errorMsg.value = err.message || 'Failed to ship order'
  }
}

async function addBlacklist() {
  errorMsg.value = ''
  try {
    await apiFetch(`/api/stores/${props.storeId}/orders/blacklist`, {
      method: 'POST',
      body: {
        phone: blacklistForm.value.phone.trim(),
        reason: blacklistForm.value.reason.trim(),
      },
    })
    blacklistForm.value = { phone: '', reason: '' }
    await loadBlacklist()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to add phone to blacklist'
  }
}

async function removeBlacklist(phone) {
  try {
    await apiFetch(
      `/api/stores/${props.storeId}/orders/blacklist/${encodeURIComponent(phone)}`,
      { method: 'DELETE' }
    )
    await loadBlacklist()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to remove phone'
  }
}

function reloadAll() {
  loadOrders()
  loadBlacklist()
}

onMounted(reloadAll)
watch(() => props.storeId, reloadAll)
watch(statusFilter, loadOrders)
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Orders &amp; Phone Blacklist</h1>
        <p class="text-muted">Confirm COD orders, dispatch to carriers, and block fake numbers.</p>
      </div>
    </div>

    <div class="tabs">
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'orders' }"
        @click="activeTab = 'orders'"
      >
        Orders ({{ orders.length }})
      </button>
      <button
        type="button"
        class="tab-btn"
        :class="{ active: activeTab === 'blacklist' }"
        @click="activeTab = 'blacklist'"
      >
        Phone Blacklist ({{ blacklist.length }})
      </button>
    </div>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <!-- Orders Tab -->
    <div v-if="activeTab === 'orders'" class="card stack">
      <div class="row-between">
        <div class="row">
          <label class="label">Status:</label>
          <select v-model="statusFilter" class="select" style="width: auto">
            <option value="">All Statuses</option>
            <option value="pending_confirmation">Pending Confirmation</option>
            <option value="confirmed">Confirmed</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="returned">Returned</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" @click="loadOrders">Refresh</button>
      </div>

      <div v-if="loading" class="empty-state">Loading orders...</div>
      <div v-else-if="orders.length === 0" class="empty-state">No orders found.</div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Wilaya</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="o in orders" :key="o.id">
              <td class="mono"><strong>#{{ o.order_number }}</strong></td>
              <td>
                <div>{{ o.customer_name }}</div>
                <div class="text-sm text-muted mono">{{ o.phone }}</div>
              </td>
              <td>{{ o.wilaya_name_fr }}</td>
              <td><strong>{{ Number(o.total_dzd).toLocaleString() }} DZD</strong></td>
              <td>
                <span class="badge">{{ o.payment_method.toUpperCase() }}</span>
              </td>
              <td>
                <span
                  class="badge"
                  :class="{
                    'badge-warning': o.status === 'pending_confirmation',
                    'badge-primary': o.status === 'confirmed' || o.status === 'shipped',
                    'badge-success': o.status === 'delivered',
                    'badge-danger': o.status === 'cancelled' || o.status === 'returned',
                  }"
                >
                  {{ o.status }}
                </span>
              </td>
              <td>
                <div class="row">
                  <button type="button" class="btn btn-secondary btn-sm" @click="openOrder(o)">
                    Details
                  </button>
                  <button
                    v-if="o.status === 'pending_confirmation'"
                    type="button"
                    class="btn btn-primary btn-sm"
                    @click="confirmOrder(o.id)"
                  >
                    Confirm
                  </button>
                  <button
                    v-if="o.status === 'confirmed' || o.status === 'pending_confirmation'"
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="shipOrder(o.id)"
                  >
                    Ship
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Blacklist Tab -->
    <div v-else class="card stack">
      <form class="row" @submit.prevent="addBlacklist">
        <input
          v-model="blacklistForm.phone"
          type="text"
          class="input mono"
          placeholder="0550123456"
          required
          style="max-width: 200px"
        />
        <input
          v-model="blacklistForm.reason"
          type="text"
          class="input"
          placeholder="Reason (e.g. Unclaimed parcel)"
          style="flex: 1"
        />
        <button type="submit" class="btn btn-primary">Block Number</button>
      </form>

      <div v-if="blacklist.length === 0" class="empty-state">No blocked phone numbers.</div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Phone</th>
              <th>Reason</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in blacklist" :key="b.phone">
              <td class="mono">{{ b.phone }}</td>
              <td>{{ b.reason || '—' }}</td>
              <td>
                <button
                  type="button"
                  class="btn btn-danger btn-sm"
                  @click="removeBlacklist(b.phone)"
                >
                  Unblock
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Order Details Modal -->
    <div v-if="selectedOrder" class="modal-backdrop" @click.self="selectedOrder = null">
      <div class="modal-card stack">
        <div class="row-between">
          <h3>Order #{{ selectedOrder.order_number }}</h3>
          <button type="button" class="btn btn-ghost btn-sm" @click="selectedOrder = null">
            ✕
          </button>
        </div>

        <div v-if="!orderDetail" class="empty-state">Loading order details...</div>
        <template v-else>
          <div class="stack-sm text-sm">
            <div><strong>Customer:</strong> {{ orderDetail.order.customer_name }} ({{ orderDetail.order.phone }})</div>
            <div><strong>Wilaya:</strong> {{ orderDetail.order.wilaya_name_fr }} — {{ orderDetail.order.delivery_type }}</div>
            <div><strong>Address:</strong> {{ orderDetail.order.address || '—' }}</div>
            <div><strong>Total:</strong> {{ Number(orderDetail.order.total_dzd).toLocaleString() }} DZD (Shipping: {{ orderDetail.order.shipping_fee_dzd }} DZD)</div>
          </div>

          <div>
            <h4>Items</h4>
            <ul class="stack-sm text-sm" style="padding-left: 1.2rem; margin-top: 0.4rem">
              <li v-for="item in orderDetail.items" :key="item.id">
                {{ item.title_snapshot }} × {{ item.qty }} — {{ item.unit_price_dzd }} DZD
              </li>
            </ul>
          </div>

          <div v-if="orderDetail.shipment" class="alert alert-info">
            <strong>Shipment:</strong> {{ orderDetail.shipment.status }}
            <span v-if="orderDetail.shipment.tracking_number" class="mono">
              ({{ orderDetail.shipment.tracking_number }})
            </span>
          </div>

          <div
            v-if="['pending_confirmation', 'confirmed'].includes(orderDetail.order.status)"
            class="stack-sm"
          >
            <div class="row">
              <input
                v-model="shipCarrierCode"
                type="text"
                class="input"
                placeholder="Carrier code (optional, e.g. manual or yalidine)"
                style="flex: 1"
              />
              <button
                type="button"
                class="btn btn-primary btn-sm"
                @click="shipOrder(orderDetail.order.id)"
              >
                Dispatch Shipment
              </button>
            </div>
            <div class="row">
              <button
                v-if="orderDetail.order.status === 'pending_confirmation'"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="confirmOrder(orderDetail.order.id)"
              >
                Confirm Order
              </button>
              <button
                type="button"
                class="btn btn-danger btn-sm"
                @click="cancelOrder(orderDetail.order.id)"
              >
                Cancel Order
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
