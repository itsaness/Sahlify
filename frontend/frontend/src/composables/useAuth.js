import { ref, computed } from 'vue'
import { apiFetch } from '../lib/api.js'

const billingModules = import.meta.glob('./useBilling.js', { eager: true })
const useBilling = billingModules['./useBilling.js']?.useBilling || null

const user = ref(null)
const sessionLoading = ref(false)
const sessionChecked = ref(false)

export function useAuth() {
  const isAuthenticated = computed(() => Boolean(user.value?.id))
  const isAdmin = computed(() => user.value?.role === 'admin')

  async function fetchSession(force = false) {
    if (sessionChecked.value && !force) return user.value
    sessionLoading.value = true
    try {
      const data = await apiFetch('/api/auth/get-session')
      user.value = data?.user || null
    } catch {
      user.value = null
    } finally {
      sessionChecked.value = true
      sessionLoading.value = false
    }
    return user.value
  }

  async function signIn({ email, password }) {
    const data = await apiFetch('/api/auth/sign-in/email', {
      method: 'POST',
      body: { email, password },
    })
    user.value = data?.user || null
    await fetchSession(true)
    return user.value
  }

  async function signUp({ name, email, password }) {
    const data = await apiFetch('/api/auth/sign-up/email', {
      method: 'POST',
      body: { name, email, password },
    })
    user.value = data?.user || null
    await fetchSession(true)
    return user.value
  }

  function sanitizeRedirectPath(raw) {
    if (typeof raw !== 'string') return '/dashboard'
    const trimmed = raw.trim()
    if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
      return '/dashboard'
    }
    return trimmed
  }

  async function signInWithGoogle(callbackPath = '/dashboard') {
    const safePath = sanitizeRedirectPath(callbackPath)
    const callbackURL = `${window.location.origin}${safePath}`
    const data = await apiFetch('/api/auth/sign-in/social', {
      method: 'POST',
      body: {
        provider: 'google',
        callbackURL,
      },
    })
    if (data?.url) {
      window.location.href = data.url
      return
    }
    throw new Error('Google sign-in is not configured on the backend')
  }

  async function signOut() {
    try {
      await apiFetch('/api/auth/sign-out', { method: 'POST', body: {} })
    } catch {
      // ignore sign-out error
    }
    user.value = null
    useBilling?.().resetBillingState()
  }

  return {
    user,
    isAuthenticated,
    isAdmin,
    sessionLoading,
    fetchSession,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
  }
}
