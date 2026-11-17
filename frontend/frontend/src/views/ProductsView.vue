<script setup>
import { ref, watch, onMounted } from 'vue'
import { apiFetch } from '../lib/api.js'

const props = defineProps({
  storeId: {
    type: String,
    required: true,
  },
})

const products = ref([])
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// Create / Edit Product Modal
const showModal = ref(false)
const editingId = ref(null)
const saving = ref(false)
const modalError = ref('')
const form = ref({
  title: '',
  slug: '',
  description: '',
  priceDzd: 0,
  compareAtDzd: null,
  stock: 10,
  sku: '',
  isActive: true,
})

// AI Copy state
const aiLoading = ref(false)
const aiNotes = ref('')

// Selected Product for Variants & Images
const activeProduct = ref(null)
const variantForm = ref({ title: '', priceDzd: '', stock: 5, sku: '' })
const imageUrlInput = ref('')
const uploadingImage = ref(false)

async function loadProducts() {
  loading.value = true
  errorMsg.value = ''
  try {
    const data = await apiFetch(`/api/stores/${props.storeId}/products`)
    products.value = data?.products || []
    if (activeProduct.value) {
      activeProduct.value = products.value.find((p) => p.id === activeProduct.value.id) || null
    }
  } catch (err) {
    errorMsg.value = err.message || 'Failed to load products'
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  modalError.value = ''
  aiNotes.value = ''
  form.value = {
    title: '',
    slug: '',
    description: '',
    priceDzd: 2500,
    compareAtDzd: null,
    stock: 10,
    sku: '',
    isActive: true,
  }
  showModal.value = true
}

function openEdit(product) {
  editingId.value = product.id
  modalError.value = ''
  aiNotes.value = ''
  form.value = {
    title: product.title,
    slug: product.slug,
    description: product.description || '',
    priceDzd: product.price_dzd,
    compareAtDzd: product.compare_at_dzd ?? null,
    stock: product.stock,
    sku: product.sku || '',
    isActive: Boolean(product.is_active),
  }
  showModal.value = true
}

async function saveProduct() {
  modalError.value = ''
  saving.value = true
  try {
    const payload = {
      title: form.value.title.trim(),
      slug: form.value.slug.trim() || undefined,
      description: form.value.description,
      priceDzd: Number(form.value.priceDzd),
      compareAtDzd:
        form.value.compareAtDzd !== null && form.value.compareAtDzd !== ''
          ? Number(form.value.compareAtDzd)
          : null,
      stock: Number(form.value.stock),
      sku: form.value.sku.trim() || null,
      isActive: form.value.isActive,
    }

    if (editingId.value) {
      await apiFetch(`/api/stores/${props.storeId}/products/${editingId.value}`, {
        method: 'PATCH',
        body: payload,
      })
      successMsg.value = 'Product updated.'
    } else {
      await apiFetch(`/api/stores/${props.storeId}/products`, {
        method: 'POST',
        body: payload,
      })
      successMsg.value = 'Product created.'
    }
    showModal.value = false
    await loadProducts()
  } catch (err) {
    modalError.value = err.message || 'Failed to save product'
  } finally {
    saving.value = false
  }
}

async function removeProduct(product) {
  if (!confirm(`Delete "${product.title}"?`)) return
  try {
    await apiFetch(`/api/stores/${props.storeId}/products/${product.id}`, {
      method: 'DELETE',
    })
    if (activeProduct.value?.id === product.id) activeProduct.value = null
    successMsg.value = 'Product deleted.'
    await loadProducts()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to delete product'
  }
}

async function generateAiCopy() {
  if (!form.value.title.trim()) {
    modalError.value = 'Enter a product title first so AI can write copy.'
    return
  }
  aiLoading.value = true
  modalError.value = ''
  try {
    const data = await apiFetch(`/api/stores/${props.storeId}/ai/product-copy`, {
      method: 'POST',
      body: {
        title: form.value.title.trim(),
        notes: aiNotes.value.trim(),
      },
    })
    if (data?.copy) {
      if (data.copy.title) form.value.title = data.copy.title
      if (data.copy.description) form.value.description = data.copy.description
    }
  } catch (err) {
    modalError.value = err.message || 'AI copy generation failed'
  } finally {
    aiLoading.value = false
  }
}

async function addVariant() {
  if (!activeProduct.value || !variantForm.value.title.trim()) return
  try {
    await apiFetch(`/api/stores/${props.storeId}/products/${activeProduct.value.id}/variants`, {
      method: 'POST',
      body: {
        title: variantForm.value.title.trim(),
        priceDzd: variantForm.value.priceDzd ? Number(variantForm.value.priceDzd) : null,
        stock: Number(variantForm.value.stock) || 0,
        sku: variantForm.value.sku.trim() || null,
      },
    })
    variantForm.value = { title: '', priceDzd: '', stock: 5, sku: '' }
    await loadProducts()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to add variant'
  }
}

async function deleteVariant(variantId) {
  if (!activeProduct.value) return
  try {
    await apiFetch(
      `/api/stores/${props.storeId}/products/${activeProduct.value.id}/variants/${variantId}`,
      { method: 'DELETE' }
    )
    await loadProducts()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to delete variant'
  }
}

async function addImageByUrl() {
  if (!activeProduct.value || !imageUrlInput.value.trim()) return
  uploadingImage.value = true
  try {
    await apiFetch(`/api/stores/${props.storeId}/products/${activeProduct.value.id}/images`, {
      method: 'POST',
      body: { url: imageUrlInput.value.trim() },
    })
    imageUrlInput.value = ''
    await loadProducts()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to add image'
  } finally {
    uploadingImage.value = false
  }
}

function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file || !activeProduct.value) return
  const reader = new FileReader()
  reader.onload = async () => {
    uploadingImage.value = true
    try {
      await apiFetch(`/api/stores/${props.storeId}/products/${activeProduct.value.id}/images`, {
        method: 'POST',
        body: { dataUrl: reader.result },
      })
      await loadProducts()
    } catch (err) {
      errorMsg.value = err.message || 'Image upload failed'
    } finally {
      uploadingImage.value = false
      event.target.value = ''
    }
  }
  reader.readAsDataURL(file)
}

async function deleteImage(imageId) {
  if (!activeProduct.value) return
  try {
    await apiFetch(
      `/api/stores/${props.storeId}/products/${activeProduct.value.id}/images/${imageId}`,
      { method: 'DELETE' }
    )
    await loadProducts()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to delete image'
  }
}

onMounted(loadProducts)
watch(() => props.storeId, loadProducts)
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Products</h1>
        <p class="text-muted">Manage your catalog, variants, images, and DZD pricing.</p>
      </div>
      <button type="button" class="btn btn-primary" @click="openCreate">+ Add Product</button>
    </div>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>

    <div class="card">
      <div v-if="loading" class="empty-state">Loading products...</div>
      <div v-else-if="products.length === 0" class="empty-state stack-sm">
        <p>No products in this store yet.</p>
        <div>
          <button type="button" class="btn btn-primary btn-sm" @click="openCreate">
            Create First Product
          </button>
        </div>
      </div>
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price (DZD)</th>
              <th>Stock</th>
              <th>Status</th>
              <th>Variants / Images</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in products" :key="p.id">
              <td>
                <div><strong>{{ p.title }}</strong></div>
                <div class="text-sm text-muted mono">{{ p.slug }}</div>
              </td>
              <td>{{ Number(p.price_dzd).toLocaleString() }} DZD</td>
              <td>{{ p.stock }}</td>
              <td>
                <span class="badge" :class="p.is_active ? 'badge-success' : 'badge-warning'">
                  {{ p.is_active ? 'Active' : 'Hidden' }}
                </span>
              </td>
              <td class="text-sm text-muted">
                {{ p.variants?.length || 0 }} variants • {{ p.images?.length || 0 }} images
              </td>
              <td>
                <div class="row">
                  <button
                    type="button"
                    class="btn btn-secondary btn-sm"
                    @click="activeProduct = p"
                  >
                    Variants &amp; Media
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm" @click="openEdit(p)">
                    Edit
                  </button>
                  <button type="button" class="btn btn-danger btn-sm" @click="removeProduct(p)">
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Variants & Images Drawer/Card -->
    <div v-if="activeProduct" class="card stack">
      <div class="row-between">
        <div>
          <h3>Variants &amp; Images — {{ activeProduct.title }}</h3>
          <p class="text-sm text-muted">Add size/color variants and product photos (max 5MB).</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" @click="activeProduct = null">
          Close
        </button>
      </div>

      <div class="grid-2">
        <!-- Variants -->
        <div class="stack-sm">
          <h4>Variants</h4>
          <div v-if="activeProduct.variants?.length" class="stack-sm">
            <div
              v-for="v in activeProduct.variants"
              :key="v.id"
              class="row-between variant-item"
            >
              <div>
                <strong>{{ v.title }}</strong>
                <span class="text-sm text-muted">
                  — {{ v.price_dzd ? `${v.price_dzd} DZD` : 'Base price' }} (Stock: {{ v.stock }})
                </span>
              </div>
              <button type="button" class="btn btn-danger btn-sm" @click="deleteVariant(v.id)">
                Remove
              </button>
            </div>
          </div>
          <p v-else class="text-sm text-muted">No variants yet.</p>

          <form class="row" @submit.prevent="addVariant">
            <input
              v-model="variantForm.title"
              type="text"
              class="input"
              placeholder="e.g. Black / XL"
              required
              style="flex: 2"
            />
            <input
              v-model="variantForm.priceDzd"
              type="number"
              class="input"
              placeholder="Price DZD"
              min="0"
              style="flex: 1"
            />
            <input
              v-model="variantForm.stock"
              type="number"
              class="input"
              placeholder="Stock"
              min="0"
              style="width: 85px"
            />
            <button type="submit" class="btn btn-primary btn-sm">Add</button>
          </form>
        </div>

        <!-- Images -->
        <div class="stack-sm">
          <h4>Images</h4>
          <div v-if="activeProduct.images?.length" class="image-grid">
            <div v-for="img in activeProduct.images" :key="img.id" class="image-tile">
              <img :src="img.url" alt="Product" />
              <button
                type="button"
                class="btn btn-danger btn-sm"
                @click="deleteImage(img.id)"
              >
                Delete
              </button>
            </div>
          </div>
          <p v-else class="text-sm text-muted">No images uploaded yet.</p>

          <div class="stack-sm">
            <div class="row">
              <input
                v-model="imageUrlInput"
                type="url"
                class="input"
                placeholder="https://... image URL"
                style="flex: 1"
              />
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="uploadingImage"
                @click="addImageByUrl"
              >
                Add URL
              </button>
            </div>
            <div class="form-group">
              <label class="label">Or upload local image (JPG, PNG, WebP)</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                :disabled="uploadingImage"
                @change="handleFileUpload"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <div v-if="showModal" class="modal-backdrop" @click.self="showModal = false">
      <div class="modal-card stack">
        <div class="row-between">
          <h3>{{ editingId ? 'Edit Product' : 'New Product' }}</h3>
          <button type="button" class="btn btn-ghost btn-sm" @click="showModal = false">✕</button>
        </div>

        <div v-if="modalError" class="alert alert-error">{{ modalError }}</div>

        <form class="stack" @submit.prevent="saveProduct">
          <div class="form-group">
            <label class="label">Title</label>
            <input v-model="form.title" type="text" class="input" required minlength="2" />
          </div>

          <div class="ai-copy-box">
            <div class="row-between">
              <span class="label">AI Product Copy Helper</span>
              <button
                type="button"
                class="btn btn-secondary btn-sm"
                :disabled="aiLoading"
                @click="generateAiCopy"
              >
                {{ aiLoading ? 'Generating...' : '✨ Generate Description' }}
              </button>
            </div>
            <input
              v-model="aiNotes"
              type="text"
              class="input"
              placeholder="Optional notes (material, target audience, delivery perks...)"
            />
          </div>

          <div class="form-group">
            <label class="label">Description</label>
            <textarea v-model="form.description" class="textarea"></textarea>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="label">Price (DZD)</label>
              <input v-model="form.priceDzd" type="number" class="input" min="0" required />
            </div>
            <div class="form-group">
              <label class="label">Compare-at Price (DZD)</label>
              <input v-model="form.compareAtDzd" type="number" class="input" min="0" />
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="label">Stock</label>
              <input v-model="form.stock" type="number" class="input" min="0" required />
            </div>
            <div class="form-group">
              <label class="label">SKU (optional)</label>
              <input v-model="form.sku" type="text" class="input mono" />
            </div>
          </div>

          <label class="checkbox-row">
            <input v-model="form.isActive" type="checkbox" />
            <span>Active (visible on storefront)</span>
          </label>

          <div class="row-between">
            <button type="button" class="btn btn-secondary" @click="showModal = false">
              Cancel
            </button>
            <button type="submit" class="btn btn-primary" :disabled="saving">
              {{ saving ? 'Saving...' : 'Save Product' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.variant-item {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
}

.image-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.75rem;
}

.image-tile {
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 0.4rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: var(--bg-soft);
}

.image-tile img {
  width: 100%;
  height: 85px;
  object-fit: cover;
  border-radius: 4px;
}

.ai-copy-box {
  padding: 0.75rem;
  background: var(--bg-soft);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
</style>
