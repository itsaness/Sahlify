<script setup>
import { computed, onMounted } from 'vue'
import { useRoute, RouterView } from 'vue-router'
import { usePlatformInfo } from './lib/api.js'
import { useAuth } from './composables/useAuth.js'
import DashboardLayout from './components/DashboardLayout.vue'

const route = useRoute()
const { checkHealth } = usePlatformInfo()
const { fetchSession } = useAuth()

const isDashboard = computed(() => route.meta?.layout === 'dashboard')
const storeId = computed(() => (route.params?.storeId ? String(route.params.storeId) : null))
const activeSection = computed(() => String(route.meta?.section || 'stores'))

onMounted(() => {
  checkHealth()
  fetchSession()
})
</script>

<template>
  <DashboardLayout v-if="isDashboard" :store-id="storeId" :active-section="activeSection">
    <template #default="{ reloadStores }">
      <RouterView @stores-updated="reloadStores" />
    </template>
  </DashboardLayout>
  <RouterView v-else />
</template>
