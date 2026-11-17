<script setup lang="ts">
const promoProps = defineProps<{
  props: {
    badge?: string;
    title: string;
    description?: string;
    bullets?: string[];
    ctaText?: string;
    ctaHref?: string;
    imageUrl?: string;
    imagePosition?: "left" | "right";
  };
}>();

const safeHref = computed(() => {
  const h = (promoProps.props.ctaHref || "#products").trim();
  return h.startsWith("#") || (h.startsWith("/") && !h.startsWith("//")) || h.startsWith("https://")
    ? h
    : "#products";
});

const safeImageUrl = computed(() => {
  const u = (promoProps.props.imageUrl || "").trim();
  return (u.startsWith("/uploads/") && !u.includes("..")) || u.startsWith("https://") ? u : "";
});
</script>

<template>
  <section style="max-width: 1160px; margin: 0 auto; padding: 3rem 1.5rem">
    <div
      style="
        background: var(--c-surface);
        border: var(--card-border);
        box-shadow: var(--card-shadow);
        border-radius: var(--radius);
        padding: 2rem;
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(270px, 1fr));
        gap: 2rem;
        align-items: center;
      "
    >
      <div :style="{ order: props.imagePosition === 'left' && safeImageUrl ? 2 : 1 }">
        <span
          v-if="props.badge"
          style="
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            font-size: 0.78rem;
            font-weight: 700;
            background: color-mix(in srgb, var(--c-primary) 12%, transparent);
            color: var(--c-primary);
            margin-bottom: 0.85rem;
          "
        >
          {{ props.badge }}
        </span>
        <h2 style="font-size: 1.65rem; font-weight: 800; margin: 0 0 0.85rem">{{ props.title }}</h2>
        <p v-if="props.description" style="color: var(--c-muted); line-height: 1.65; margin: 0 0 1rem">
          {{ props.description }}
        </p>
        <ul
          v-if="props.bullets?.length"
          style="list-style: none; padding: 0; margin: 0 0 1.4rem; display: grid; gap: 0.5rem"
        >
          <li
            v-for="(b, idx) in props.bullets"
            :key="idx"
            style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.95rem"
          >
            <span style="color: var(--c-primary); font-weight: 800">✓</span>
            <span>{{ b }}</span>
          </li>
        </ul>
        <a
          v-if="props.ctaText"
          :href="safeHref"
          style="
            display: inline-block;
            background: var(--c-primary);
            color: #ffffff;
            padding: 0.75rem 1.6rem;
            border-radius: var(--radius);
            text-decoration: none;
            font-weight: 700;
          "
        >
          {{ props.ctaText }}
        </a>
      </div>

      <div v-if="safeImageUrl" :style="{ order: props.imagePosition === 'left' ? 1 : 2 }">
        <img
          :src="safeImageUrl"
          :alt="props.title"
          style="width: 100%; max-height: 360px; object-fit: cover; border-radius: var(--radius)"
        />
      </div>
    </div>
  </section>
</template>
