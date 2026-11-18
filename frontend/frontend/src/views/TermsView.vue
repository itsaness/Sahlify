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
          <h1>Terms of Service</h1>
          <p class="text-sm text-muted">Last updated: November 2026</p>
        </div>

        <section class="stack-sm">
          <h3>1. Platform &amp; Licensing</h3>
          <p class="text-muted">
            Sahlify is provided in two editions: Sahlify Cloud (managed hosting with DZD
            subscriptions) and the Self-Hosted Edition licensed under AGPL-3.0. Self-hosted
            deployments must preserve the "Powered by Sahlify" attribution notice under AGPL-3.0
            Section 7(b) unless covered by a Commercial White-Label License.
          </p>
        </section>

        <section class="stack-sm">
          <h3>2. Merchant Responsibilities</h3>
          <p class="text-muted">
            Merchants are solely responsible for the products they list, pricing, order
            fulfillment, customer support, and compliance with applicable Algerian laws and
            commercial regulations.
          </p>
        </section>

        <section class="stack-sm">
          <h3>3. Payments &amp; Billing</h3>
          <p class="text-muted">
            Cloud subscriptions and online store checkouts are processed in Algerian Dinars (DZD)
            via Chargily Pay (Edahabia / CIB) or Cash on Delivery (COD). Unpaid cloud
            subscriptions enter a grace period before store suspension.
          </p>
        </section>

        <section class="stack-sm">
          <h3>4. Availability &amp; Limitation of Liability</h3>
          <p class="text-muted">
            The service is provided "as is" without warranties of uninterrupted availability,
            including uptime of third-party express carriers, Chargily Pay, Meta CAPI, or AI
            providers.
          </p>
        </section>
      </article>
    </main>

    <PublicFooter />
  </div>
</template>
