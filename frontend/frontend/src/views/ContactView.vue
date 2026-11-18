<script setup>
import PublicNavbar from '../components/PublicNavbar.vue'
import PublicFooter from '../components/PublicFooter.vue'
</script>

<template>
  <div class="contact-page" style="min-height: 100vh; display: flex; flex-direction: column">
    <PublicNavbar />

    <main class="container page-section">
      <div class="card stack" style="max-width: 520px; margin: 0 auto; text-align: center">
        <h1>Contact</h1>
        <p class="text-muted">
          For support, white-label licensing, or general inquiries, reach us by email:
        </p>
        <div>
          <a href="mailto:contact@sahlify.dz" class="mono" style="font-size: 1.1rem; font-weight: 700">
            contact@sahlify.dz
          </a>
        </div>
      </div>
    </main>

    <PublicFooter />
  </div>
</template>
