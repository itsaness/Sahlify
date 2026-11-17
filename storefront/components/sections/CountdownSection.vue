<script setup lang="ts">
const cdProps = defineProps<{
  props: {
    badge?: string;
    title: string;
    subtitle?: string;
    hours?: number;
    ctaText?: string;
    ctaHref?: string;
  };
}>();

const safeHref = computed(() => {
  const h = (cdProps.props.ctaHref || "#products").trim();
  return h.startsWith("#") || (h.startsWith("/") && !h.startsWith("//")) || h.startsWith("https://")
    ? h
    : "#products";
});

const remainingSec = ref((cdProps.props.hours || 24) * 3600);
let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  timer = setInterval(() => {
    if (remainingSec.value > 0) remainingSec.value -= 1;
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const parts = computed(() => {
  const s = remainingSec.value;
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return {
    hrs: String(hrs).padStart(2, "0"),
    mins: String(mins).padStart(2, "0"),
    secs: String(secs).padStart(2, "0"),
  };
});
</script>

<template>
  <section style="max-width: 1160px; margin: 0 auto; padding: 2.5rem 1.5rem">
    <div
      style="
        background: linear-gradient(135deg, var(--c-primary), color-mix(in srgb, var(--c-primary) 70%, #000000));
        color: #ffffff;
        border-radius: var(--radius);
        padding: 2.25rem 1.75rem;
        text-align: center;
        display: grid;
        gap: 1rem;
        justify-items: center;
      "
    >
      <span
        v-if="props.badge"
        style="
          background: rgba(255, 255, 255, 0.2);
          padding: 0.25rem 0.85rem;
          border-radius: 999px;
          font-size: 0.78rem;
          font-weight: 700;
        "
      >
        {{ props.badge }}
      </span>
      <h2 style="font-size: clamp(1.4rem, 3vw, 2rem); font-weight: 800; margin: 0">
        {{ props.title }}
      </h2>
      <p v-if="props.subtitle" style="margin: 0; max-width: 600px; opacity: 0.9">
        {{ props.subtitle }}
      </p>

      <div style="display: flex; gap: 0.75rem; direction: ltr; margin: 0.35rem 0">
        <div
          v-for="(val, label) in { H: parts.hrs, M: parts.mins, S: parts.secs }"
          :key="label"
          style="
            background: rgba(0, 0, 0, 0.25);
            padding: 0.65rem 1rem;
            border-radius: 10px;
            min-width: 64px;
          "
        >
          <div style="font-size: 1.5rem; font-weight: 800; line-height: 1">{{ val }}</div>
          <div style="font-size: 0.7rem; opacity: 0.8; margin-top: 0.25rem">{{ label }}</div>
        </div>
      </div>

      <a
        v-if="props.ctaText"
        :href="safeHref"
        style="
          display: inline-block;
          background: #ffffff;
          color: #111827;
          padding: 0.75rem 1.75rem;
          border-radius: var(--radius);
          text-decoration: none;
          font-weight: 800;
        "
      >
        {{ props.ctaText }}
      </a>
    </div>
  </section>
</template>
