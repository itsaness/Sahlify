<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth.js'
import { useI18n } from '../composables/useI18n.js'
import PublicNavbar from '../components/PublicNavbar.vue'

const route = useRoute()
const router = useRouter()
const { signIn, signUp, signInWithGoogle } = useAuth()
const { t } = useI18n()

const mode = ref(route.query.mode === 'register' ? 'register' : 'login')
const name = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const googleLoading = ref(false)
const errorMsg = ref('')

watch(
  () => route.query.mode,
  (val) => {
    mode.value = val === 'register' ? 'register' : 'login'
  }
)

function sanitizeRedirect(raw) {
  if (typeof raw !== 'string') return '/dashboard'
  const trimmed = raw.trim()
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) {
    return '/dashboard'
  }
  return trimmed
}

async function handleSubmit() {
  errorMsg.value = ''
  loading.value = true
  try {
    if (mode.value === 'register') {
      await signUp({
        name: name.value.trim(),
        email: email.value.trim(),
        password: password.value,
      })
    } else {
      await signIn({
        email: email.value.trim(),
        password: password.value,
      })
    }
    router.push(sanitizeRedirect(route.query.redirect))
  } catch (err) {
    errorMsg.value = err.message || 'Authentication failed'
  } finally {
    loading.value = false
  }
}

async function handleGoogleSignIn() {
  errorMsg.value = ''
  googleLoading.value = true
  try {
    await signInWithGoogle(sanitizeRedirect(route.query.redirect))
  } catch (err) {
    errorMsg.value = err.message || 'Google sign-in failed'
    googleLoading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <PublicNavbar />

    <main class="container page-section auth-container">
      <div class="card auth-card stack">
        <div class="tabs">
          <button
            type="button"
            class="tab-btn"
            :class="{ active: mode === 'login' }"
            @click="mode = 'login'"
          >
            {{ t.auth.signInTab }}
          </button>
          <button
            type="button"
            class="tab-btn"
            :class="{ active: mode === 'register' }"
            @click="mode = 'register'"
          >
            {{ t.auth.registerTab }}
          </button>
        </div>

        <div>
          <h2>{{ mode === 'login' ? t.auth.welcomeBack : t.auth.createAccountTitle }}</h2>
          <p class="text-sm text-muted">
            {{ mode === 'login' ? t.auth.signInSub : t.auth.registerSub }}
          </p>
        </div>

        <div v-if="errorMsg" class="alert alert-error">
          {{ errorMsg }}
        </div>

        <button
          type="button"
          class="btn btn-secondary btn-lg google-btn"
          :disabled="googleLoading || loading"
          @click="handleGoogleSignIn"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
            />
          </svg>
          <span>{{ googleLoading ? t.auth.pleaseWait : t.auth.continueWithGoogle }}</span>
        </button>

        <div class="auth-divider">
          <span>{{ t.auth.or }}</span>
        </div>

        <form class="stack" @submit.prevent="handleSubmit">
          <div v-if="mode === 'register'" class="form-group">
            <label class="label" for="auth-name">{{ t.auth.fullName }}</label>
            <input
              id="auth-name"
              v-model="name"
              type="text"
              class="input"
              placeholder="Amine Benali"
              required
              minlength="2"
            />
          </div>

          <div class="form-group">
            <label class="label" for="auth-email">{{ t.auth.email }}</label>
            <input
              id="auth-email"
              v-model="email"
              type="email"
              class="input"
              placeholder="merchant@example.dz"
              required
            />
          </div>

          <div class="form-group">
            <label class="label" for="auth-password">{{ t.auth.password }}</label>
            <input
              id="auth-password"
              v-model="password"
              type="password"
              class="input"
              :placeholder="t.auth.passwordPlaceholder"
              required
              minlength="8"
            />
          </div>

          <button type="submit" class="btn btn-primary btn-lg" :disabled="loading || googleLoading">
            {{
              loading
                ? t.auth.pleaseWait
                : mode === 'login'
                  ? t.auth.signInTab
                  : t.auth.registerTab
            }}
          </button>
        </form>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-container {
  display: flex;
  justify-content: center;
}

.auth-card {
  width: 100%;
  max-width: 440px;
}

.google-btn {
  width: 100%;
  gap: 0.65rem;
}

.auth-divider {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--text-muted);
  font-size: 0.82rem;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}
</style>
