<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from '../composables/useI18n.js'
import PublicNavbar from '../components/PublicNavbar.vue'

const router = useRouter()
const navigate = (to) => router.push(to)
const { t } = useI18n()
</script>

<template>
  <div class="landing-page">
    <PublicNavbar />

    <main>
      <!-- Hero Section -->
      <section class="hero-section">
        <div class="container hero-inner">
          <span class="badge badge-primary">{{ t.landing.badge }}</span>
          <h1 class="hero-title">{{ t.landing.title }}</h1>
          <p class="hero-subtitle">{{ t.landing.subtitle }}</p>

          <div class="hero-cta-group">
            <button
              type="button"
              class="btn btn-secondary btn-lg"
              @click="navigate('/docs')"
            >
              {{ t.landing.selfHost }}
            </button>
            <button
              type="button"
              class="btn btn-primary btn-lg"
              @click="navigate('/pricing')"
            >
              {{ t.landing.cloud }}
            </button>
          </div>

          <p class="hero-note text-sm text-muted">
            {{ t.landing.heroNotePre }} <strong>{{ t.landing.selfHost }}</strong>
            {{ t.landing.heroNoteMid }} <strong>{{ t.landing.cloud }}</strong>
            {{ t.landing.heroNotePost }}
          </p>
        </div>
      </section>

      <!-- Features Grid -->
      <section class="page-section features-section">
        <div class="container">
          <div class="section-heading">
            <h2>{{ t.landing.featuresTitle }}</h2>
            <p class="text-muted">{{ t.landing.featuresSubtitle }}</p>
          </div>

          <div class="grid-2">
            <div v-for="feat in t.landing.features" :key="feat.title" class="card feature-card">
              <h3>{{ feat.title }}</h3>
              <p class="text-muted">{{ feat.desc }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Two Modes Summary -->
      <section class="page-section modes-section">
        <div class="container">
          <div class="grid-2">
            <div class="card mode-card">
              <div class="row-between">
                <h3>{{ t.landing.selfHostedTitle }}</h3>
                <span class="badge">{{ t.landing.selfHostedBadge }}</span>
              </div>
              <p class="text-muted">{{ t.landing.selfHostedDesc }}</p>
              <div>
                <button type="button" class="btn btn-secondary" @click="navigate('/docs')">
                  {{ t.landing.selfHostedBtn }}
                </button>
              </div>
            </div>

            <div class="card mode-card mode-card-highlight">
              <div class="row-between">
                <h3>{{ t.landing.cloudTitle }}</h3>
                <span class="badge badge-primary">{{ t.landing.cloudBadge }}</span>
              </div>
              <p class="text-muted">{{ t.landing.cloudDesc }}</p>
              <div>
                <button type="button" class="btn btn-primary" @click="navigate('/pricing')">
                  {{ t.landing.cloudBtn }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="public-footer">
      <div class="container row-between">
        <span class="text-sm text-muted">{{ t.landing.footerText }}</span>
        <div class="row text-sm">
          <a href="/docs" @click.prevent="navigate('/docs')">{{ t.nav.docs }}</a>
          <a href="/pricing" @click.prevent="navigate('/pricing')">{{ t.nav.pricing }}</a>
          <a href="/auth" @click.prevent="navigate('/auth')">{{ t.landing.merchantSignIn }}</a>
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.hero-section {
  padding: 5rem 0 4rem;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.hero-inner {
  max-width: 760px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.hero-title {
  font-size: clamp(2rem, 4.5vw, 3rem);
  letter-spacing: -0.02em;
}

.hero-subtitle {
  font-size: 1.1rem;
  color: var(--text-muted);
  max-width: 640px;
}

.hero-cta-group {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 0.5rem;
  flex-wrap: wrap;
}

.hero-cta-group .btn {
  min-width: 160px;
}

.section-heading {
  text-align: center;
  margin-bottom: 2.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.feature-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.modes-section {
  padding-top: 0;
}

.mode-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
}

.mode-card-highlight {
  border-color: var(--primary);
}

.public-footer {
  border-top: 1px solid var(--border);
  padding: 1.75rem 0;
  margin-top: 2rem;
  background: var(--surface);
}

@media (max-width: 640px) {
  .hero-section {
    padding: 3rem 0 2.5rem;
  }

  .hero-subtitle {
    font-size: 0.98rem;
  }

  .hero-cta-group {
    width: 100%;
  }

  .hero-cta-group .btn {
    flex: 1;
    min-width: 130px;
  }

  .public-footer .row-between {
    justify-content: center;
    text-align: center;
  }
}
</style>
