<script setup lang="ts">
defineProps<{
  props: { title?: string; items: Array<{ author: string; city?: string; rating: number; comment: string }> };
}>();
</script>

<template>
  <section style="max-width: 1160px; margin: 0 auto; padding: 3rem 1.5rem">
    <h2 v-if="props.title" style="font-size: 1.6rem; font-weight: 800; margin: 0 0 1.5rem; text-align: center">
      {{ props.title }}
    </h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.15rem">
      <div
        v-for="(item, i) in props.items"
        :key="i"
        style="
          background: var(--c-surface);
          border: var(--card-border);
          box-shadow: var(--card-shadow);
          border-radius: var(--radius);
          padding: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        "
      >
        <div style="color: #f59e0b; font-size: 1rem; letter-spacing: 2px">
          {{ "★".repeat(item.rating) }}
        </div>
        <p style="margin: 0; color: var(--c-text); line-height: 1.6; flex: 1">"{{ item.comment }}"</p>
        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.85rem; padding-top: 0.5rem; border-top: 1px solid rgba(128, 128, 128, 0.12)">
          <div>
            <strong>{{ item.author }}</strong>
            <span v-if="item.city" style="color: var(--c-muted)"> — {{ item.city }}</span>
          </div>
          <span style="color: #16a34a; font-weight: 700; font-size: 0.78rem">✓</span>
        </div>
      </div>
    </div>
  </section>
</template>
