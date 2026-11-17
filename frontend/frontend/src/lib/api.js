import { ref } from 'vue'

const API_BASE = import.meta.env.VITE_API_BASE || ''

export async function apiFetch(endpoint, options = {}) {
  const { method = 'GET', body, headers = {} } = options
  const fetchHeaders = { ...headers }

  let payload = body
  if (body !== undefined && body !== null && typeof body === 'object' && !(body instanceof FormData)) {
    fetchHeaders['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers: fetchHeaders,
    body: payload,
    credentials: 'include',
  })

  if (res.status === 204) {
    return null
  }

  let data = null
  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    data = await res.json().catch(() => null)
  } else {
    const text = await res.text().catch(() => '')
    data = text ? { message: text } : null
  }

  if (!res.ok) {
    const errMessage =
      data?.message ||
      data?.error?.message ||
      (Array.isArray(data?.errors) && data.errors[0]?.message) ||
      `Request failed (${res.status})`
    const error = new Error(errMessage)
    error.status = res.status
    error.data = data
    throw error
  }

  return data
}

const deploymentMode = ref('cloud')
const backendOnline = ref(true)
let healthChecked = false

export function usePlatformInfo() {
  async function checkHealth() {
    if (healthChecked) return
    healthChecked = true
    try {
      const data = await apiFetch('/health')
      if (data?.mode) {
        deploymentMode.value = data.mode
      }
      backendOnline.value = true
    } catch {
      backendOnline.value = false
    }
  }

  return {
    deploymentMode,
    backendOnline,
    checkHealth,
  }
}
