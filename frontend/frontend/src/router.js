import { createRouter, createWebHistory } from 'vue-router'
import { useAuth } from './composables/useAuth.js'
import { usePlatformInfo } from './lib/api.js'

import LandingView from './views/LandingView.vue'
import DocsView from './views/DocsView.vue'
import AuthView from './views/AuthView.vue'
import StoresView from './views/StoresView.vue'
import ProductsView from './views/ProductsView.vue'
import OrdersView from './views/OrdersView.vue'
import ShippingView from './views/ShippingView.vue'
import ThemesView from './views/ThemesView.vue'
import IntegrationsView from './views/IntegrationsView.vue'
import StoreSettingsView from './views/StoreSettingsView.vue'

const billingModules = import.meta.glob('./composables/useBilling.js', { eager: true })
const useBilling = billingModules['./composables/useBilling.js']?.useBilling || null
const cloudViews = import.meta.glob('./views/{PricingView,BillingView,AdminView}.vue')

const routes = [
  { path: '/', name: 'landing', component: LandingView },
  { path: '/docs', name: 'docs', component: DocsView },
  cloudViews['./views/PricingView.vue']
    ? { path: '/pricing', name: 'pricing', component: cloudViews['./views/PricingView.vue'] }
    : { path: '/pricing', redirect: '/dashboard' },
  { path: '/auth', name: 'auth', component: AuthView },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: StoresView,
    meta: { requiresAuth: true, layout: 'dashboard', section: 'stores' },
  },
  cloudViews['./views/AdminView.vue']
    ? {
        path: '/admin',
        name: 'admin',
        component: cloudViews['./views/AdminView.vue'],
        meta: { requiresAuth: true, requiresSubscription: false, layout: 'dashboard', section: 'admin' },
      }
    : { path: '/admin', redirect: '/dashboard' },
  {
    path: '/stores/:storeId',
    redirect: (to) => `/stores/${to.params.storeId}/products`,
  },
  {
    path: '/stores/:storeId/products',
    name: 'store-products',
    component: ProductsView,
    props: true,
    meta: { requiresAuth: true, layout: 'dashboard', section: 'products' },
  },
  {
    path: '/stores/:storeId/orders',
    name: 'store-orders',
    component: OrdersView,
    props: true,
    meta: { requiresAuth: true, layout: 'dashboard', section: 'orders' },
  },
  {
    path: '/stores/:storeId/shipping',
    name: 'store-shipping',
    component: ShippingView,
    props: true,
    meta: { requiresAuth: true, layout: 'dashboard', section: 'shipping' },
  },
  {
    path: '/stores/:storeId/themes',
    name: 'store-themes',
    component: ThemesView,
    props: true,
    meta: { requiresAuth: true, layout: 'dashboard', section: 'themes' },
  },
  {
    path: '/stores/:storeId/integrations',
    name: 'store-integrations',
    component: IntegrationsView,
    props: true,
    meta: { requiresAuth: true, layout: 'dashboard', section: 'integrations' },
  },
  cloudViews['./views/BillingView.vue']
    ? {
        path: '/stores/:storeId/billing',
        name: 'store-billing',
        component: cloudViews['./views/BillingView.vue'],
        props: true,
        meta: { requiresAuth: true, requiresSubscription: false, layout: 'dashboard', section: 'billing' },
      }
    : { path: '/stores/:storeId/billing', redirect: '/dashboard' },
  {
    path: '/stores/:storeId/settings',
    name: 'store-settings',
    component: StoreSettingsView,
    props: true,
    meta: { requiresAuth: true, layout: 'dashboard', section: 'settings' },
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  },
})

router.beforeEach(async (to) => {
  if (!to.meta.requiresAuth) return true

  const { isAuthenticated, isAdmin, fetchSession } = useAuth()
  await fetchSession()
  if (!isAuthenticated.value) {
    return { path: '/auth', query: { redirect: to.fullPath } }
  }

  const { deploymentMode, checkHealth } = usePlatformInfo()
  await checkHealth()

  if (
    useBilling &&
    deploymentMode.value === 'cloud' &&
    to.meta.requiresSubscription !== false &&
    !isAdmin.value
  ) {
    const { fetchAccountBilling } = useBilling()
    const forceRefresh = to.query?.billing === 'success'
    const active = await fetchAccountBilling(forceRefresh)
    if (!active) {
      return { path: '/pricing', query: { reason: 'subscription_required' } }
    }
  }

  return true
})

export default router
