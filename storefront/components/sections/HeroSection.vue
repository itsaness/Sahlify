<script setup lang="ts">
const heroProps = defineProps<{
  props: {
    title: string;
    subtitle?: string;
    badge?: string;
    ctaText?: string;
    ctaHref?: string;
    secondaryCtaText?: string;
    secondaryCtaHref?: string;
    imageUrl?: string;
    variant?: "centered" | "split" | "immersive";
  };
}>();

function sanitizeHref(val: string | undefined, fallback = "#products") {
  const h = (val || fallback).trim();
  return h.startsWith("#") || (h.startsWith("/") && !h.startsWith("//")) || h.startsWith("https://")
    ? h
    : fallback;
}

const safeHref = computed(() => sanitizeHref(heroProps.props.ctaHref, "#products"));
const safeSecondaryHref = computed(() =>
  sanitizeHref(heroProps.props.secondaryCtaHref, "#products")
);

const safeImageUrl = computed(() => {
  const u = (heroProps.props.imageUrl || "").trim();
  return (u.startsWith("/uploads/") && !u.includes("..")) || u.startsWith("https://") ? u : "";
});

const isSplit = computed(() => heroProps.props.variant === "split" && Boolean(safeImageUrl.value));
const isImmersive = computed(() => heroProps.props.variant === "immersive");
</script>

<template>
  <section
    :style="{
      background: isImmersive
        ? 'radial-gradient(circle at top center, color-mix(in srgb, var(--c-primary) 16%, transparent), transparent 65%)'
        : 'transparent',
    }"
    style="padding: 3.75rem 1.5rem"
  >
    <div
      style="max-width: 1160px; margin: 0 auto"
      :style="
        isSplit
          ? {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))',
              gap: '2.5rem',
              alignItems: 'center',
              textAlign: 'start',
            }
          : { textAlign: 'center' }
      "
    >
      <div>
        <span
          v-if="props.badge"
          style="
            display: inline-block;
            padding: 0.3rem 0.9rem;
            border-radius: 999px;
            font-size: 0.8rem;
            font-weight: 700;
            margin-bottom: 1.1rem;
            background: color-mix(in srgb, var(--c-primary) 12%, transparent);
            color: var(--c-primary);
            border: 1px solid color-mix(in srgb, var(--c-primary) 28%, transparent);
          "
        >
          {{ props.badge }}
        </span>

        <h1
          style="
            font-size: clamp(2rem, 4.4vw, 3.25rem);
            font-weight: 800;
            line-height: 1.18;
            margin: 0 0 1.1rem;
          "
        >
          {{ props.title }}
        </h1>

        <p
          v-if="props.subtitle"
          :style="isSplit ? { margin: '0 0 1.85rem' } : { margin: '0 auto 1.85rem' }"
          style="color: var(--c-muted); max-width: 620px; font-size: 1.12rem; line-height: 1.65"
        >
          {{ props.subtitle }}
        </p>

        <div
          :style="isSplit ? { justifyContent: 'flex-start' } : { justifyContent: 'center' }"
          style="display: flex; gap: 0.85rem; flex-wrap: wrap; align-items: center"
        >
          <a
            v-if="props.ctaText"
            :href="safeHref"
            style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              background: var(--c-primary);
              color: #ffffff;
              padding: 0.9rem 2rem;
              border-radius: var(--radius);
              text-decoration: none;
              font-weight: 700;
              box-shadow: 0 10px 24px -10px color-mix(in srgb, var(--c-primary) 70%, transparent);
            "
          >
            {{ props.ctaText }}
          </a>
          <a
            v-if="props.secondaryCtaText"
            :href="safeSecondaryHref"
            style="
              display: inline-flex;
              align-items: center;
              justify-content: center;
              background: var(--c-surface);
              color: var(--c-text);
              border: 1px solid rgba(128, 128, 128, 0.25);
              padding: 0.9rem 1.75rem;
              border-radius: var(--radius);
              text-decoration: none;
              font-weight: 600;
            "
          >
            {{ props.secondaryCtaText }}
          </a>
        </div>
      </div>

      <div v-if="safeImageUrl" :style="isSplit ? {} : { marginTop: '2.5rem' }">
        <img
          :src="safeImageUrl"
          :alt="props.title"
          style="
            display: block;
            width: 100%;
            max-height: 460px;
            object-fit: cover;
            margin: 0 auto;
            border-radius: var(--radius);
            box-shadow: 0 20px 45px -18px rgba(0, 0, 0, 0.25);
          "
        />
      </div>
    </div>
  </section>
</template>
