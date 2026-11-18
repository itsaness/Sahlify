<script setup>
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'
</script>

<template>
  <div class="legal-page" style="min-height: 100vh; display: flex; flex-direction: column">
    <PublicNavbar />

    <main class="container page-section">
      <article class="card stack" style="max-width: 820px; margin: 0 auto">
        <div>
          <h1>Privacy Policy</h1>
          <p class="text-sm text-muted">Last updated: November 2026</p>
        </div>

        <section class="stack-sm">
          <h3>1. Data We Collect</h3>
          <p class="text-muted">
            For merchants, we store your name, email address, and store configuration. For
            storefront orders, we collect customer name, phone number, wilaya/commune, and delivery
            address solely to fulfill the order.
          </p>
        </section>

        <section class="stack-sm">
          <h3>2. Credential Security</h3>
          <p class="text-muted">
            Merchant integration secrets (express carrier tokens, Chargily API keys, and Meta CAPI
            access tokens) are protected using industry-standard encryption at rest.
          </p>
        </section>

        <section class="stack-sm">
          <h3>3. Third-Party Sharing</h3>
          <p class="text-muted">
            Order details are shared only with the merchant's selected delivery carrier, Chargily
            Pay (when online payment is chosen), and Meta Conversions API (with hashed customer
            identifiers when enabled by the merchant).
          </p>
        </section>

        <section class="stack-sm">
          <h3>4. Data Retention</h3>
          <p class="text-muted">
            Sahlify automatically scrubs customer IP addresses, user agents, and Meta attribution
            cookies (fbp/fbc) from orders after 30 days, and purges incoming webhook logs after 90
            days.
          </p>
        </section>
      </article>
    </main>

    <PublicFooter />
  </div>
</template>
