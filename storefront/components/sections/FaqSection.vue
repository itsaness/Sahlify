<script setup lang="ts">
defineProps<{ props: { title?: string; items: Array<{ q: string; a: string }> } }>();
</script>

<template>
  <section id="faq" style="max-width: 840px; margin: 0 auto; padding: 3rem 1.5rem">
    <h2 v-if="props.title" style="font-size: 1.6rem; font-weight: 800; margin: 0 0 1.5rem; text-align: center">
      {{ props.title }}
    </h2>
    <div style="display: grid; gap: 0.85rem">
      <details
        v-for="(item, i) in props.items"
        :key="i"
        style="
          background: var(--c-surface);
          border: var(--card-border);
          box-shadow: var(--card-shadow);
          border-radius: var(--radius);
          padding: 1.1rem 1.25rem;
        "
      >
        <summary style="font-weight: 700; cursor: pointer; list-style: none; display: flex; justify-content: space-between; align-items: center">
          <span>{{ item.q }}</span>
          <span style="color: var(--c-primary); font-weight: 800">+</span>
        </summary>
        <p style="color: var(--c-muted); margin: 0.85rem 0 0; line-height: 1.65">{{ item.a }}</p>
      </details>
    </div>
  </section>
</template>
