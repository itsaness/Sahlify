<script setup lang="ts">
defineProps<{
  props: {
    subtitle?: string;
    items: Array<{ icon: string; label: string }>;
  };
}>();
</script>

<template>
  <section style="max-width: 1160px; margin: 0 auto; padding: 1.5rem">
    <p v-if="props.subtitle" style="text-align: center; color: var(--c-muted); margin: 0 0 1rem">
      {{ props.subtitle }}
    </p>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 1rem">
      <div
        v-for="(item, i) in props.items"
        :key="i"
        style="
          background: var(--c-surface);
          border: var(--card-border);
          box-shadow: var(--card-shadow);
          border-radius: var(--radius);
          padding: 1.1rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 600;
          font-size: 0.92rem;
        "
      >
        <span
          aria-hidden="true"
          style="
            width: 38px;
            height: 38px;
            border-radius: 10px;
            flex-shrink: 0;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            background: color-mix(in srgb, var(--c-primary) 12%, transparent);
            color: var(--c-primary);
          "
        >
          <!-- COD / Cash -->
          <svg v-if="item.icon === 'cod'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="2" y="6" width="20" height="12" rx="2" />
            <circle cx="12" cy="12" r="2.5" />
          </svg>
          <!-- Fast Delivery -->
          <svg v-else-if="item.icon === 'fast_delivery'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 3h15v13H1z" />
            <path d="M16 8h4l3 3v5h-7V8z" />
            <circle cx="5.5" cy="18.5" r="2.5" />
            <circle cx="18.5" cy="18.5" r="2.5" />
          </svg>
          <!-- 58/69 Wilayas -->
          <svg v-else-if="item.icon === '58_wilayas'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 21s-6-5.33-6-10a6 6 0 1 1 12 0c0 4.67-6 10-6 10z" />
            <circle cx="12" cy="11" r="2" />
          </svg>
          <!-- Secure Payment -->
          <svg v-else-if="item.icon === 'secure_payment'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <!-- Exchange -->
          <svg v-else-if="item.icon === 'exchange'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M17 1l4 4-4 4" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <path d="M7 23l-4-4 4-4" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
          <!-- Support -->
          <svg v-else-if="item.icon === 'support'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <!-- Quality (default) -->
          <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        </span>
        <span>{{ item.label }}</span>
      </div>
    </div>
  </section>
</template>
