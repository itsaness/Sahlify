<script setup>
import { useRouter } from 'vue-router'
import { useI18n } from '../composables/useI18n.js'
import PublicNavbar from '../components/PublicNavbar.vue'

const router = useRouter()
const navigate = (to) => router.push(to)
const { t } = useI18n()
</script>

<template>
  <div class="docs-page">
    <PublicNavbar />

    <div class="container docs-layout page-section">
      <aside class="docs-sidebar card">
        <h4>{{ t.docs.sidebarTitle }}</h4>
        <nav class="docs-toc">
          <a href="#overview">1. Overview &amp; Modes</a>
          <a href="#quickstart">2. Docker Quickstart</a>
          <a href="#env">3. Environment Variables</a>
          <a href="#local-dev">4. Local Development</a>
          <a href="#carriers-capi">5. Carriers &amp; Meta CAPI</a>
        </nav>
        <div class="docs-sidebar-cta">
          <button type="button" class="btn btn-primary btn-sm" @click="navigate('/auth')">
            {{ t.docs.openDashboard }}
          </button>
          <button type="button" class="btn btn-ghost btn-sm" @click="navigate('/pricing')">
            {{ t.docs.preferCloud }}
          </button>
        </div>
      </aside>

      <article class="docs-content stack">
        <div id="overview" class="card stack-sm">
          <span class="badge badge-primary">{{ t.docs.badge }}</span>
          <h1>{{ t.docs.title }}</h1>
          <p class="text-muted">
            Sahlify is open-source (AGPL-3.0) and built for effortless self-hosting:
          </p>
          <ul class="docs-list">
            <li>
              <strong>Free &amp; Unlimited</strong>: Stores go <code>active</code> immediately upon
              creation with no platform fees or artificial limits.
            </li>
            <li>
              <strong>Full Algerian E-Commerce Stack</strong>: Accept COD &amp; Chargily
              Edahabia/CIB payments, connect 10+ Algerian express carriers, track Meta CAPI on
              delivery, and optionally bring your own AI API key (OpenRouter, OpenAI, Anthropic,
              Gemini, or local Ollama).
            </li>
          </ul>
        </div>

        <div id="quickstart" class="card stack-sm">
          <h2>2. Quickstart with Docker Compose</h2>
          <p class="text-muted">
            The fastest way to run Sahlify on a Linux VPS is using the included
            <code>docker/docker-compose.yml</code> stack (PostgreSQL 16, Express API, Nuxt
            Storefront, and Caddy reverse proxy).
          </p>
          <pre class="code-block"># 1. Clone the repository
git clone https://github.com/your-org/sahlify.git
cd sahlify

# 2. Configure environment variables
cp backend/.env.example docker/.env

# 3. Generate strong secrets for BETTER_AUTH_SECRET and ENCRYPTION_KEY (64 hex chars)
openssl rand -hex 32

# 4. Launch PostgreSQL, Backend, Storefront &amp; Caddy
cd docker
docker compose up -d --build</pre>
          <p class="text-sm text-muted">
            On boot, the backend automatically runs SQL migrations and seeds all
            <strong>69 Algerian wilayas</strong>, <strong>11 delivery carriers</strong>, and default
            reference data.
          </p>
        </div>

        <div id="env" class="card stack-sm">
          <h2>3. Key Environment Variables</h2>
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Variable</th>
                  <th>Default / Example</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="mono">BETTER_AUTH_SECRET</td>
                  <td class="mono">(required)</td>
                  <td>Minimum 32-character secret used to sign session tokens.</td>
                </tr>
                <tr>
                  <td class="mono">ENCRYPTION_KEY</td>
                  <td class="mono">(required, 64 hex)</td>
                  <td>32-byte hex key (AES-256-GCM) encrypting carrier, Chargily &amp; Meta tokens.</td>
                </tr>
                <tr>
                  <td class="mono">AI_PROVIDER</td>
                  <td class="mono">openrouter</td>
                  <td><code>openrouter</code>, <code>openai</code>, <code>anthropic</code>, or <code>ollama</code>.</td>
                </tr>
                <tr>
                  <td class="mono">AI_API_KEY</td>
                  <td class="mono">(optional)</td>
                  <td>API key for AI theme &amp; product copy generation.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div id="local-dev" class="card stack-sm">
          <h2>4. Local Development (Node.js + Vue)</h2>
          <p class="text-muted">To run the backend and this Vue dashboard locally:</p>
          <pre class="code-block"># Terminal 1 — Backend API (port 3000)
cd backend
cp .env.example .env
npm install
npm run dev

# Terminal 2 — Vue Merchant Frontend (port 5173)
cd frontend/frontend
npm install
npm run dev</pre>
        </div>

        <div id="carriers-capi" class="card stack-sm">
          <h2>5. Connecting Carriers, Chargily &amp; Meta CAPI</h2>
          <p class="text-muted">
            Once signed in to your dashboard, open your store and visit
            <strong>Integrations &amp; CAPI</strong>:
          </p>
          <ul class="docs-list">
            <li>
              <strong>Algerian Express Carriers</strong>: Connect Yalidine, Guepex, ZR Express,
              Maystro, Noest, DHD, Anderson, Rocket Delivery, Conexlog, MSM Go, or use Manual
              Delivery.
            </li>
            <li>
              <strong>Chargily Pay (DZD)</strong>: Enter your Chargily V2 Secret Key (Test or Live
              mode) to accept Edahabia and CIB cards on your storefront.
            </li>
            <li>
              <strong>Meta Conversions API (CAPI)</strong>: Add your Pixel ID and Access Token.
              Sahlify dispatches a server-side <code>Lead</code> event when an order is placed and a
              <code>Purchase</code> event when the carrier confirms delivery.
            </li>
          </ul>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.docs-layout {
  display: grid;
  grid-template-columns: 250px 1fr;
  gap: 1.5rem;
  align-items: start;
}

.docs-sidebar {
  position: sticky;
  top: 84px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.docs-toc {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  font-size: 0.9rem;
}

.docs-toc a {
  color: var(--text-muted);
  text-decoration: none;
}

.docs-toc a:hover {
  color: var(--primary);
}

.docs-sidebar-cta {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border);
}

.docs-list {
  padding-left: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

@media (max-width: 820px) {
  .docs-layout {
    grid-template-columns: 1fr;
  }
  .docs-sidebar {
    position: static;
  }
}
</style>

