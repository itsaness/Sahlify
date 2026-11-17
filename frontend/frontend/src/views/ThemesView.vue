<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { apiFetch } from '../lib/api.js'

const props = defineProps({
  storeId: {
    type: String,
    required: true,
  },
})

const ALLOWED_FONTS = [
  'Cairo',
  'Tajawal',
  'Almarai',
  'Readex Pro',
  'Changa',
  'Inter',
  'Plus Jakarta Sans',
  'Outfit',
  'DM Sans',
  'Playfair Display',
]

const COLOR_PRESETS = [
  { name: 'Emerald DZ', primary: '#0F766E', background: '#FAFAFA', surface: '#FFFFFF', text: '#111827', muted: '#6B7280' },
  { name: 'Royal Oud', primary: '#C9A227', background: '#0B0B0F', surface: '#15151C', text: '#F9FAFB', muted: '#9CA3AF' },
  { name: 'Rose Beauty', primary: '#BE185D', background: '#FFF9FB', surface: '#FFFFFF', text: '#1F2937', muted: '#6B7280' },
  { name: 'Cobalt Tech', primary: '#2563EB', background: '#F8FAFC', surface: '#FFFFFF', text: '#0F172A', muted: '#475569' },
  { name: 'Mono Street', primary: '#111827', background: '#F4F4F5', surface: '#FFFFFF', text: '#09090B', muted: '#71717A' },
]

const SECTION_TEMPLATES = {
  banner: () => ({ type: 'banner', props: { text: 'توصيل لـ 69 ولاية — الدفع عند الاستلام', badge: 'عرض', variant: 'gradient' } }),
  hero: () => ({
    type: 'hero',
    props: {
      badge: 'تشكيلة جديدة',
      title: 'عنوان المتجر الرئيسي',
      subtitle: 'وصف قصير وجذاب يعرّف بمنتجاتك وخدمة التوصيل.',
      ctaText: 'تسوق الآن',
      ctaHref: '#products',
      secondaryCtaText: '',
      secondaryCtaHref: '#products',
      imageUrl: '',
      variant: 'centered',
    },
  }),
  trust_badges: () => ({
    type: 'trust_badges',
    props: {
      subtitle: '',
      items: [
        { icon: 'cod', label: 'الدفع عند الاستلام' },
        { icon: '58_wilayas', label: 'توصيل 69 ولاية' },
        { icon: 'fast_delivery', label: 'شحن سريع' },
      ],
    },
  }),
  product_grid: () => ({
    type: 'product_grid',
    props: { title: 'منتجاتنا', subtitle: '', columns: 3, limit: 12, showSearch: true, badgeText: '' },
  }),
  promo_split: () => ({
    type: 'promo_split',
    props: {
      badge: 'عرض خاص',
      title: 'لماذا تختار متجرنا؟',
      description: 'جودة مضمونة وتوصيل سريع لباب المنزل في جميع الولايات.',
      bullets: ['جودة عالية ومضمونة', 'توصيل خلال 24-72 ساعة'],
      ctaText: 'اطلب الآن',
      ctaHref: '#products',
      imageUrl: '',
      imagePosition: 'right',
    },
  }),
  countdown: () => ({
    type: 'countdown',
    props: {
      badge: 'عرض محدود',
      title: 'تخفيضات نهاية الأسبوع',
      subtitle: 'استفد من العرض قبل انتهاء الوقت',
      hours: 24,
      ctaText: 'استفد الآن',
      ctaHref: '#products',
    },
  }),
  reviews: () => ({
    type: 'reviews',
    props: {
      title: 'آراء العملاء',
      items: [{ author: 'أمين ب.', city: 'الجزائر', rating: 5, comment: 'منتج ممتاز والتوصيل سريع جداً!' }],
    },
  }),
  faq: () => ({
    type: 'faq',
    props: {
      title: 'الأسئلة الشائعة',
      items: [{ q: 'كيف يتم الدفع؟', a: 'الدفع نقداً عند الاستلام أو عبر البطاقة الذهبية و CIB.' }],
    },
  }),
}

function defaultDraftTheme() {
  return {
    tokens: {
      colors: { primary: '#0F766E', background: '#FAFAFA', surface: '#FFFFFF', text: '#111827', muted: '#6B7280' },
      font: 'Cairo',
      radius: 'lg',
      direction: 'rtl',
      headerStyle: 'glass',
      cardStyle: 'elevated',
      brand: { logoUrl: '', whatsapp: '', phone: '', instagram: '', tiktok: '', facebook: '' },
    },
    pages: {
      home: {
        sections: [
          SECTION_TEMPLATES.banner(),
          SECTION_TEMPLATES.hero(),
          SECTION_TEMPLATES.trust_badges(),
          SECTION_TEMPLATES.product_grid(),
        ],
      },
      product: { layout: 'landing_page', showRelated: true },
    },
  }
}

function normalizeThemeForEditor(raw) {
  const base = defaultDraftTheme()
  const src = structuredClone(raw || {})
  return {
    tokens: {
      colors: { ...base.tokens.colors, ...(src.tokens?.colors || {}) },
      font: src.tokens?.font || base.tokens.font,
      radius: src.tokens?.radius || base.tokens.radius,
      direction: src.tokens?.direction || base.tokens.direction,
      headerStyle: src.tokens?.headerStyle || 'minimal',
      cardStyle: src.tokens?.cardStyle || 'bordered',
      brand: { ...base.tokens.brand, ...(src.tokens?.brand || {}) },
    },
    pages: {
      home: {
        sections: Array.isArray(src.pages?.home?.sections) && src.pages.home.sections.length
          ? src.pages.home.sections
          : base.pages.home.sections,
      },
      product: {
        layout: src.pages?.product?.layout || 'landing_page',
        showRelated: src.pages?.product?.showRelated !== false,
      },
    },
  }
}

const activeTab = ref('design')
const previewMode = ref('desktop') // 'desktop' | 'mobile'
const storeInfo = ref(null)
const themes = ref([])
const starterTemplates = ref([])
const aiUsage = ref(null)
const loading = ref(false)
const working = ref(false)
const errorMsg = ref('')
const successMsg = ref('')
const previewUrl = ref('')

const draftTheme = ref(defaultDraftTheme())
const expandedSectionIdx = ref(0)
const newSectionType = ref('promo_split')

const generatePrompt = ref('')
const editPrompt = ref('')
const selectedThemeId = ref('')

async function loadThemes() {
  loading.value = true
  errorMsg.value = ''
  try {
    const [storeData, themesData, usageData] = await Promise.all([
      apiFetch(`/api/stores/${props.storeId}`),
      apiFetch(`/api/stores/${props.storeId}/themes`),
      apiFetch(`/api/stores/${props.storeId}/ai/usage`).catch(() => null),
    ])
    storeInfo.value = storeData?.store || null
    themes.value = themesData?.themes || []
    starterTemplates.value = themesData?.starterTemplates || []
    aiUsage.value = usageData

    if (themes.value.length > 0) {
      if (!selectedThemeId.value) selectedThemeId.value = themes.value[0].id
      const activeOrLatest = themes.value.find((t) => t.status === 'published') || themes.value[0]
      draftTheme.value = normalizeThemeForEditor(activeOrLatest.theme)
    } else if (starterTemplates.value.length > 0) {
      draftTheme.value = normalizeThemeForEditor(starterTemplates.value[0].theme)
    }
  } catch (err) {
    errorMsg.value = err.message || 'Failed to load themes'
  } finally {
    loading.value = false
  }
}

function loadThemeIntoEditor(themeObj) {
  draftTheme.value = normalizeThemeForEditor(themeObj)
  expandedSectionIdx.value = 0
  successMsg.value = 'Loaded into Visual Studio editor. Save or Publish when ready.'
}

function applyColorPreset(preset) {
  draftTheme.value.tokens.colors = {
    primary: preset.primary,
    background: preset.background,
    surface: preset.surface,
    text: preset.text,
    muted: preset.muted,
  }
}

function addSection() {
  const sections = draftTheme.value.pages.home.sections
  if (sections.length >= 12) {
    errorMsg.value = 'Maximum 12 homepage sections allowed.'
    return
  }
  const factory = SECTION_TEMPLATES[newSectionType.value]
  if (factory) {
    sections.push(factory())
    expandedSectionIdx.value = sections.length - 1
  }
}

function moveSection(idx, delta) {
  const sections = draftTheme.value.pages.home.sections
  const target = idx + delta
  if (target < 0 || target >= sections.length) return
  const [item] = sections.splice(idx, 1)
  sections.splice(target, 0, item)
  expandedSectionIdx.value = target
}

function removeSection(idx) {
  const sections = draftTheme.value.pages.home.sections
  if (sections.length <= 1) {
    errorMsg.value = 'At least 1 section is required on the homepage.'
    return
  }
  sections.splice(idx, 1)
  expandedSectionIdx.value = Math.max(0, idx - 1)
}

async function saveDraftFromEditor(andPublish = false) {
  working.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const res = await apiFetch(`/api/stores/${props.storeId}/themes/draft`, {
      method: 'POST',
      body: { theme: draftTheme.value },
    })
    if (andPublish && res?.theme?.id) {
      await apiFetch(`/api/stores/${props.storeId}/themes/${res.theme.id}/publish`, {
        method: 'POST',
      })
      successMsg.value = 'Theme saved and published to your live storefront!'
    } else {
      successMsg.value = 'Theme draft saved.'
    }
    await loadThemes()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to save theme'
  } finally {
    working.value = false
  }
}

async function applyStarterTemplate(templateKey) {
  working.value = true
  errorMsg.value = ''
  try {
    await apiFetch(`/api/stores/${props.storeId}/themes/draft`, {
      method: 'POST',
      body: { templateKey },
    })
    successMsg.value = 'Starter template saved as a new draft.'
    await loadThemes()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to save draft'
  } finally {
    working.value = false
  }
}

async function generateWithAi() {
  if (!generatePrompt.value.trim()) return
  working.value = true
  errorMsg.value = ''
  try {
    await apiFetch(`/api/stores/${props.storeId}/ai/generate-theme`, {
      method: 'POST',
      body: { prompt: generatePrompt.value.trim() },
    })
    generatePrompt.value = ''
    successMsg.value = 'AI theme generated as a new draft!'
    await loadThemes()
  } catch (err) {
    errorMsg.value = err.message || 'AI theme generation failed'
  } finally {
    working.value = false
  }
}

async function editWithAi() {
  if (!editPrompt.value.trim()) return
  working.value = true
  errorMsg.value = ''
  try {
    await apiFetch(`/api/stores/${props.storeId}/ai/edit-theme`, {
      method: 'POST',
      body: {
        prompt: editPrompt.value.trim(),
        themeId: selectedThemeId.value || undefined,
      },
    })
    editPrompt.value = ''
    successMsg.value = 'AI theme edit saved as a new draft!'
    await loadThemes()
  } catch (err) {
    errorMsg.value = err.message || 'AI theme edit failed'
  } finally {
    working.value = false
  }
}

async function publishTheme(themeId) {
  working.value = true
  errorMsg.value = ''
  try {
    await apiFetch(`/api/stores/${props.storeId}/themes/${themeId}/publish`, {
      method: 'POST',
    })
    successMsg.value = 'Theme published to your live storefront!'
    await loadThemes()
  } catch (err) {
    errorMsg.value = err.message || 'Failed to publish theme'
  } finally {
    working.value = false
  }
}

function buildStorePreviewUrl(token) {
  const slug = storeInfo.value?.slug
  if (!slug) return ''
  const host = window.location.hostname
  if (host === 'localhost' || host === '127.0.0.1') {
    const port = import.meta.env.VITE_STOREFRONT_PORT || '3001'
    return `http://${slug}.localhost:${port}/?preview=${encodeURIComponent(token)}`
  }
  const customDomain = storeInfo.value?.custom_domain
  const verified = Boolean(storeInfo.value?.custom_domain_verified_at)
  const baseDomain = import.meta.env.VITE_STORE_BASE_DOMAIN || host.replace(/^www\./, '')
  const targetHost = customDomain && verified ? customDomain : `${slug}.${baseDomain}`
  return `${window.location.protocol}//${targetHost}/?preview=${encodeURIComponent(token)}`
}

async function generatePreview(themeId) {
  errorMsg.value = ''
  try {
    const data = await apiFetch(`/api/stores/${props.storeId}/themes/preview-token`, {
      method: 'POST',
      body: { themeId },
    })
    const token = data?.previewToken || ''
    if (!token) throw new Error('Could not create preview token')
    const url = buildStorePreviewUrl(token)
    previewUrl.value = url
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  } catch (err) {
    errorMsg.value = err.message || 'Could not create preview token'
  }
}

const previewRadius = computed(() => {
  const map = { none: '0px', sm: '6px', md: '10px', lg: '16px', full: '24px' }
  return map[draftTheme.value.tokens.radius] || '16px'
})

onMounted(loadThemes)
watch(() => props.storeId, loadThemes)
</script>

<template>
  <div class="stack">
    <div class="row-between">
      <div>
        <h1>Storefront Theme Studio</h1>
        <p class="text-muted">Customize colors, branding, homepage sections, or generate a design with AI.</p>
      </div>
      <div class="row">
        <span v-if="aiUsage" class="badge badge-primary">
          AI: {{ aiUsage.aiEnabled ? 'Enabled' : 'Off' }}
        </span>
        <button type="button" class="btn btn-secondary" :disabled="working" @click="saveDraftFromEditor(false)">
          Save Draft
        </button>
        <button type="button" class="btn btn-primary" :disabled="working" @click="saveDraftFromEditor(true)">
          {{ working ? 'Saving...' : 'Save & Publish' }}
        </button>
      </div>
    </div>

    <div v-if="errorMsg" class="alert alert-error">{{ errorMsg }}</div>
    <div v-if="successMsg" class="alert alert-success">{{ successMsg }}</div>
    <div v-if="previewUrl" class="alert alert-info">
      <strong>Preview URL:</strong>
      <a :href="previewUrl" target="_blank" rel="noopener noreferrer" class="mono text-sm"> {{ previewUrl }}</a>
    </div>

    <div class="tabs">
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'design' }" @click="activeTab = 'design'">
        Design &amp; Colors
      </button>
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'branding' }" @click="activeTab = 'branding'">
        Branding &amp; Socials
      </button>
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'sections' }" @click="activeTab = 'sections'">
        Sections ({{ draftTheme.pages.home.sections.length }})
      </button>
      <button type="button" class="tab-btn" :class="{ active: activeTab === 'ai' }" @click="activeTab = 'ai'">
        AI &amp; Templates
      </button>
    </div>

    <!-- Studio Split Layout -->
    <div class="studio-grid">
      <!-- Left: Controls -->
      <div class="stack">
        <!-- TAB 1: Design & Colors -->
        <div v-if="activeTab === 'design'" class="card stack">
          <div>
            <h3>Curated Color Palettes</h3>
            <div class="row" style="margin-top: 0.5rem">
              <button
                v-for="p in COLOR_PRESETS"
                :key="p.name"
                type="button"
                class="btn btn-secondary btn-sm"
                @click="applyColorPreset(p)"
              >
                <span class="swatch-dot" :style="{ background: p.primary }"></span>
                {{ p.name }}
              </button>
            </div>
          </div>

          <div class="grid-2">
            <div
              v-for="(label, key) in {
                primary: 'Primary Brand',
                background: 'Page Background',
                surface: 'Card Surface',
                text: 'Main Text',
                muted: 'Muted Text',
              }"
              :key="key"
              class="form-group"
            >
              <label class="label">{{ label }}</label>
              <div class="row">
                <input
                  v-model="draftTheme.tokens.colors[key]"
                  type="color"
                  style="width: 42px; height: 36px; border: none; padding: 0; background: none; cursor: pointer"
                />
                <input v-model="draftTheme.tokens.colors[key]" type="text" class="input mono" maxlength="7" />
              </div>
            </div>
          </div>

          <div class="grid-2">
            <div class="form-group">
              <label class="label">Font Family</label>
              <select v-model="draftTheme.tokens.font" class="select">
                <option v-for="f in ALLOWED_FONTS" :key="f" :value="f">{{ f }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Corner Radius</label>
              <select v-model="draftTheme.tokens.radius" class="select">
                <option value="none">Square (none)</option>
                <option value="sm">Small (sm)</option>
                <option value="md">Medium (md)</option>
                <option value="lg">Large (lg)</option>
                <option value="full">Pill (full)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Direction</label>
              <select v-model="draftTheme.tokens.direction" class="select">
                <option value="rtl">RTL (Arabic)</option>
                <option value="ltr">LTR (French / English)</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Header Style</label>
              <select v-model="draftTheme.tokens.headerStyle" class="select">
                <option value="glass">Glass (Sticky Blur)</option>
                <option value="minimal">Solid Minimal</option>
                <option value="centered">Centered</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Card Style</label>
              <select v-model="draftTheme.tokens.cardStyle" class="select">
                <option value="elevated">Elevated (Shadow)</option>
                <option value="bordered">Bordered</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div class="form-group">
              <label class="label">Product Page</label>
              <label class="checkbox-row" style="margin-top: 0.4rem">
                <input v-model="draftTheme.pages.product.showRelated" type="checkbox" />
                <span>Show related products</span>
              </label>
            </div>
          </div>
        </div>

        <!-- TAB 2: Branding & Socials -->
        <div v-else-if="activeTab === 'branding'" class="card stack">
          <h3>Store Identity &amp; Contact</h3>
          <div class="form-group">
            <label class="label">Store Logo URL (/uploads/... or https://...)</label>
            <input v-model="draftTheme.tokens.brand.logoUrl" type="text" class="input mono" placeholder="https://..." />
          </div>
          <div class="grid-2">
            <div class="form-group">
              <label class="label">WhatsApp Number</label>
              <input v-model="draftTheme.tokens.brand.whatsapp" type="text" class="input mono" placeholder="0550123456" />
            </div>
            <div class="form-group">
              <label class="label">Support Phone</label>
              <input v-model="draftTheme.tokens.brand.phone" type="text" class="input mono" placeholder="0550123456" />
            </div>
          </div>
          <div class="form-group">
            <label class="label">Instagram URL (https://...)</label>
            <input v-model="draftTheme.tokens.brand.instagram" type="url" class="input mono" placeholder="https://instagram.com/..." />
          </div>
          <div class="form-group">
            <label class="label">TikTok URL (https://...)</label>
            <input v-model="draftTheme.tokens.brand.tiktok" type="url" class="input mono" placeholder="https://tiktok.com/@..." />
          </div>
          <div class="form-group">
            <label class="label">Facebook URL (https://...)</label>
            <input v-model="draftTheme.tokens.brand.facebook" type="url" class="input mono" placeholder="https://facebook.com/..." />
          </div>
        </div>

        <!-- TAB 3: Sections Builder -->
        <div v-else-if="activeTab === 'sections'" class="card stack">
          <div class="row-between">
            <h3>Homepage Sections</h3>
            <div class="row">
              <select v-model="newSectionType" class="select" style="width: auto">
                <option value="banner">Announcement Banner</option>
                <option value="hero">Hero</option>
                <option value="trust_badges">Trust Badges</option>
                <option value="product_grid">Product Grid</option>
                <option value="promo_split">Promo Split</option>
                <option value="countdown">Flash Sale Countdown</option>
                <option value="reviews">Customer Reviews</option>
                <option value="faq">FAQ Accordion</option>
              </select>
              <button type="button" class="btn btn-primary btn-sm" @click="addSection">+ Add</button>
            </div>
          </div>

          <div
            v-for="(sec, idx) in draftTheme.pages.home.sections"
            :key="idx"
            class="section-item"
          >
            <div class="row-between" style="cursor: pointer" @click="expandedSectionIdx = expandedSectionIdx === idx ? -1 : idx">
              <div>
                <strong class="mono">{{ idx + 1 }}. {{ sec.type }}</strong>
                <span v-if="sec.props?.title || sec.props?.text" class="text-sm text-muted">
                  — {{ (sec.props.title || sec.props.text || '').slice(0, 40) }}
                </span>
              </div>
              <div class="row" @click.stop>
                <button type="button" class="btn btn-ghost btn-sm" :disabled="idx === 0" @click="moveSection(idx, -1)">↑</button>
                <button
                  type="button"
                  class="btn btn-ghost btn-sm"
                  :disabled="idx === draftTheme.pages.home.sections.length - 1"
                  @click="moveSection(idx, 1)"
                >
                  ↓
                </button>
                <button type="button" class="btn btn-danger btn-sm" @click="removeSection(idx)">✕</button>
              </div>
            </div>

            <!-- Inline Section Prop Editor -->
            <div v-if="expandedSectionIdx === idx" class="stack-sm" style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border)">
              <template v-if="sec.type === 'banner'">
                <input v-model="sec.props.badge" class="input" placeholder="Badge (e.g. عرض)" />
                <input v-model="sec.props.text" class="input" placeholder="Announcement text" />
                <select v-model="sec.props.variant" class="select">
                  <option value="solid">Solid</option>
                  <option value="gradient">Gradient</option>
                </select>
              </template>

              <template v-else-if="sec.type === 'hero'">
                <select v-model="sec.props.variant" class="select">
                  <option value="centered">Centered</option>
                  <option value="split">Split (Text + Image)</option>
                  <option value="immersive">Immersive Glow</option>
                </select>
                <input v-model="sec.props.badge" class="input" placeholder="Eyebrow badge (optional)" />
                <input v-model="sec.props.title" class="input" placeholder="Hero title" />
                <textarea v-model="sec.props.subtitle" class="textarea" placeholder="Subtitle"></textarea>
                <div class="grid-2">
                  <input v-model="sec.props.ctaText" class="input" placeholder="CTA button text" />
                  <input v-model="sec.props.ctaHref" class="input mono" placeholder="#products" />
                </div>
                <input v-model="sec.props.imageUrl" class="input mono" placeholder="Hero image URL (https://... or /uploads/...)" />
              </template>

              <template v-else-if="sec.type === 'product_grid'">
                <input v-model="sec.props.title" class="input" placeholder="Section title" />
                <input v-model="sec.props.subtitle" class="input" placeholder="Subtitle (optional)" />
                <div class="grid-2">
                  <select v-model.number="sec.props.columns" class="select">
                    <option :value="2">2 Columns</option>
                    <option :value="3">3 Columns</option>
                    <option :value="4">4 Columns</option>
                  </select>
                  <input v-model.number="sec.props.limit" type="number" min="1" max="24" class="input" placeholder="Max products" />
                </div>
                <label class="checkbox-row">
                  <input v-model="sec.props.showSearch" type="checkbox" />
                  <span>Show search &amp; price sort bar</span>
                </label>
              </template>

              <template v-else-if="sec.type === 'promo_split'">
                <input v-model="sec.props.badge" class="input" placeholder="Badge" />
                <input v-model="sec.props.title" class="input" placeholder="Title" />
                <textarea v-model="sec.props.description" class="textarea" placeholder="Description"></textarea>
                <input v-model="sec.props.ctaText" class="input" placeholder="CTA text" />
                <input v-model="sec.props.imageUrl" class="input mono" placeholder="Image URL" />
              </template>

              <template v-else-if="sec.type === 'countdown'">
                <input v-model="sec.props.badge" class="input" placeholder="Badge" />
                <input v-model="sec.props.title" class="input" placeholder="Offer title" />
                <input v-model="sec.props.subtitle" class="input" placeholder="Subtitle" />
                <div class="grid-2">
                  <input v-model.number="sec.props.hours" type="number" min="1" max="720" class="input" placeholder="Hours" />
                  <input v-model="sec.props.ctaText" class="input" placeholder="CTA text" />
                </div>
              </template>

              <template v-else-if="sec.type === 'trust_badges'">
                <div v-for="(item, bi) in sec.props.items" :key="bi" class="row">
                  <select v-model="item.icon" class="select" style="max-width: 150px">
                    <option value="cod">COD</option>
                    <option value="58_wilayas">69 Wilayas</option>
                    <option value="fast_delivery">Fast Delivery</option>
                    <option value="quality">Quality</option>
                    <option value="exchange">Exchange</option>
                    <option value="secure_payment">Secure Pay</option>
                    <option value="support">Support</option>
                  </select>
                  <input v-model="item.label" class="input" />
                </div>
              </template>

              <template v-else-if="sec.type === 'reviews'">
                <input v-model="sec.props.title" class="input" placeholder="Section title" />
                <div v-for="(rev, ri) in sec.props.items" :key="ri" class="stack-sm" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px">
                  <div class="grid-2">
                    <input v-model="rev.author" class="input" placeholder="Author" />
                    <input v-model="rev.city" class="input" placeholder="Wilaya / City" />
                  </div>
                  <input v-model="rev.comment" class="input" placeholder="Comment" />
                </div>
              </template>

              <template v-else-if="sec.type === 'faq'">
                <input v-model="sec.props.title" class="input" placeholder="FAQ Title" />
                <div v-for="(f, fi) in sec.props.items" :key="fi" class="stack-sm" style="padding: 0.5rem; border: 1px solid var(--border); border-radius: 6px">
                  <input v-model="f.q" class="input" placeholder="Question" />
                  <input v-model="f.a" class="input" placeholder="Answer" />
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- TAB 4: AI & Templates -->
        <div v-else class="stack">
          <div class="grid-2">
            <div class="card stack-sm">
              <h3>✨ Generate with AI</h3>
              <textarea
                v-model="generatePrompt"
                class="textarea"
                placeholder="e.g. Modern luxury perfume store in dark gold & cream with Arabic RTL layout"
              ></textarea>
              <button type="button" class="btn btn-primary" :disabled="working || !generatePrompt.trim()" @click="generateWithAi">
                {{ working ? 'Working...' : 'Generate Draft Theme' }}
              </button>
            </div>

            <div class="card stack-sm">
              <h3>🎨 Edit with AI</h3>
              <select v-model="selectedThemeId" class="select">
                <option v-for="t in themes" :key="t.id" :value="t.id">
                  v{{ t.version }} ({{ t.status }}) — {{ t.created_by }}
                </option>
              </select>
              <textarea
                v-model="editPrompt"
                class="textarea"
                placeholder="e.g. Change primary color to emerald green and add a countdown section"
              ></textarea>
              <button type="button" class="btn btn-secondary" :disabled="working || !editPrompt.trim()" @click="editWithAi">
                {{ working ? 'Working...' : 'Apply AI Edit' }}
              </button>
            </div>
          </div>

          <div class="card stack-sm">
            <h3>Starter Templates ({{ starterTemplates.length }})</h3>
            <div class="grid-2">
              <div v-for="tpl in starterTemplates" :key="tpl.key" class="template-card">
                <div class="row">
                  <span class="swatch-dot" :style="{ background: tpl.theme?.tokens?.colors?.primary }"></span>
                  <div>
                    <strong>{{ tpl.name }}</strong>
                    <div class="text-sm text-muted mono">{{ tpl.key }}</div>
                  </div>
                </div>
                <div class="row">
                  <button type="button" class="btn btn-ghost btn-sm" @click="loadThemeIntoEditor(tpl.theme)">
                    Edit
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" :disabled="working" @click="applyStarterTemplate(tpl.key)">
                    Use
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="card stack-sm">
            <h3>Saved Theme Versions</h3>
            <div v-if="loading" class="empty-state">Loading themes...</div>
            <div v-else-if="themes.length === 0" class="empty-state">No saved themes yet.</div>
            <div v-else class="table-wrap">
              <table class="table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Source</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="t in themes" :key="t.id">
                    <td class="mono"><strong>v{{ t.version }}</strong></td>
                    <td>
                      <span class="badge" :class="t.status === 'published' ? 'badge-success' : 'badge-warning'">
                        {{ t.status }}
                      </span>
                    </td>
                    <td>{{ t.created_by }}</td>
                    <td>
                      <div class="row">
                        <button type="button" class="btn btn-ghost btn-sm" @click="loadThemeIntoEditor(t.theme)">
                          Load
                        </button>
                        <button
                          v-if="t.status !== 'published'"
                          type="button"
                          class="btn btn-primary btn-sm"
                          :disabled="working"
                          @click="publishTheme(t.id)"
                        >
                          Publish
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" @click="generatePreview(t.id)">
                          Open Tab
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: Live Storefront Preview -->
      <div class="card stack-sm preview-pane">
        <div class="row-between">
          <strong>Live Preview</strong>
          <div class="row">
            <button
              type="button"
              class="btn btn-sm"
              :class="previewMode === 'desktop' ? 'btn-primary' : 'btn-ghost'"
              @click="previewMode = 'desktop'"
            >
              Desktop
            </button>
            <button
              type="button"
              class="btn btn-sm"
              :class="previewMode === 'mobile' ? 'btn-primary' : 'btn-ghost'"
              @click="previewMode = 'mobile'"
            >
              Mobile
            </button>
          </div>
        </div>

        <div
          class="preview-frame"
          :class="{ 'preview-mobile': previewMode === 'mobile' }"
          :dir="draftTheme.tokens.direction"
          :style="{
            background: draftTheme.tokens.colors.background,
            color: draftTheme.tokens.colors.text,
            fontFamily: `'${draftTheme.tokens.font}', sans-serif`,
          }"
        >
          <!-- Mini Storefront Header -->
          <div
            class="pv-header"
            :style="{
              background: draftTheme.tokens.colors.surface,
              borderBottom: '1px solid rgba(128,128,128,0.16)',
            }"
          >
            <strong>{{ storeInfo?.name || 'My Store' }}</strong>
            <span :style="{ color: draftTheme.tokens.colors.muted, fontSize: '0.75rem' }">
              {{ draftTheme.tokens.direction === 'rtl' ? 'المنتجات' : 'Catalog' }}
            </span>
          </div>

          <!-- Mini Sections -->
          <div v-for="(sec, idx) in draftTheme.pages.home.sections" :key="idx">
            <div
              v-if="sec.type === 'banner'"
              style="padding: 0.4rem 0.75rem; text-align: center; color: #fff; font-size: 0.72rem"
              :style="{ background: draftTheme.tokens.colors.primary }"
            >
              <span v-if="sec.props.badge" style="font-weight: 700; margin-inline-end: 0.4rem">[{{ sec.props.badge }}]</span>
              {{ sec.props.text }}
            </div>

            <div v-else-if="sec.type === 'hero'" style="padding: 1.5rem 1rem; text-align: center">
              <div
                v-if="sec.props.badge"
                style="display: inline-block; padding: 0.15rem 0.6rem; border-radius: 999px; font-size: 0.68rem; font-weight: 700; margin-bottom: 0.5rem"
                :style="{ background: draftTheme.tokens.colors.primary + '22', color: draftTheme.tokens.colors.primary }"
              >
                {{ sec.props.badge }}
              </div>
              <div style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.35rem">{{ sec.props.title }}</div>
              <div style="font-size: 0.78rem; margin-bottom: 0.75rem" :style="{ color: draftTheme.tokens.colors.muted }">
                {{ sec.props.subtitle }}
              </div>
              <span
                style="display: inline-block; padding: 0.4rem 1rem; color: #fff; font-size: 0.75rem; font-weight: 700"
                :style="{ background: draftTheme.tokens.colors.primary, borderRadius: previewRadius }"
              >
                {{ sec.props.ctaText }}
              </span>
            </div>

            <div v-else-if="sec.type === 'trust_badges'" style="padding: 0.6rem 0.85rem; display: grid; grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 0.4rem">
              <div
                v-for="(item, bi) in sec.props.items"
                :key="bi"
                style="padding: 0.45rem; font-size: 0.68rem; font-weight: 600; text-align: center; border: 1px solid rgba(128,128,128,0.15)"
                :style="{ background: draftTheme.tokens.colors.surface, borderRadius: previewRadius }"
              >
                ✓ {{ item.label }}
              </div>
            </div>

            <div v-else-if="sec.type === 'product_grid'" style="padding: 0.9rem 0.85rem">
              <div style="font-weight: 800; font-size: 0.9rem; margin-bottom: 0.5rem">{{ sec.props.title }}</div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem">
                <div
                  v-for="n in 2"
                  :key="n"
                  style="padding: 0.5rem; border: 1px solid rgba(128,128,128,0.15)"
                  :style="{ background: draftTheme.tokens.colors.surface, borderRadius: previewRadius }"
                >
                  <div style="height: 55px; background: rgba(128,128,128,0.12); border-radius: 6px; margin-bottom: 0.35rem"></div>
                  <div style="font-size: 0.75rem; font-weight: 700">Product {{ n }}</div>
                  <div style="font-size: 0.72rem; font-weight: 800" :style="{ color: draftTheme.tokens.colors.primary }">3,500 DZD</div>
                </div>
              </div>
            </div>

            <div
              v-else-if="sec.type === 'countdown'"
              style="margin: 0.6rem 0.85rem; padding: 0.85rem; color: #fff; text-align: center"
              :style="{ background: draftTheme.tokens.colors.primary, borderRadius: previewRadius }"
            >
              <div style="font-weight: 800; font-size: 0.85rem">{{ sec.props.title }}</div>
              <div style="font-size: 0.7rem; opacity: 0.9">{{ sec.props.hours }}h</div>
            </div>

            <div
              v-else
              style="margin: 0.5rem 0.85rem; padding: 0.65rem; border: 1px solid rgba(128,128,128,0.15); font-size: 0.74rem"
              :style="{ background: draftTheme.tokens.colors.surface, borderRadius: previewRadius }"
            >
              <strong>{{ sec.props?.title || sec.type }}</strong>
            </div>
          </div>

          <div
            style="padding: 0.85rem; text-align: center; font-size: 0.7rem; border-top: 1px solid rgba(128,128,128,0.15)"
            :style="{ color: draftTheme.tokens.colors.muted, background: draftTheme.tokens.colors.surface }"
          >
            © {{ new Date().getFullYear() }} {{ storeInfo?.name || 'My Store' }} • Powered by Sahlify
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.studio-grid {
  display: grid;
  grid-template-columns: 1.25fr 0.95fr;
  gap: 1.25rem;
  align-items: start;
}
@media (max-width: 980px) {
  .studio-grid {
    grid-template-columns: 1fr;
  }
}
.preview-pane {
  position: sticky;
  top: 1rem;
}
.preview-frame {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
  min-height: 460px;
  transition: max-width 0.2s ease;
  width: 100%;
  margin: 0 auto;
}
.preview-mobile {
  max-width: 340px;
}
.pv-header {
  padding: 0.65rem 0.9rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.85rem;
}
.swatch-dot {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 999px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}
.section-item {
  padding: 0.75rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
}
.template-card {
  padding: 0.85rem;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--bg-soft);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}
</style>
