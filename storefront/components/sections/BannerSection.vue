<script setup lang="ts">
const bannerProps = defineProps<{
  props: { text: string; badge?: string; variant?: "solid" | "gradient" | "marquee" };
}>();

const bgStyle = computed(() => {
  if (bannerProps.props.variant === "gradient") {
    return "linear-gradient(90deg, var(--c-primary), color-mix(in srgb, var(--c-primary) 70%, #000000))";
  }
  return "var(--c-primary)";
});
</script>

<template>
  <div
    :style="{ background: bgStyle }"
    style="
      color: #ffffff;
      text-align: center;
      padding: 0.55rem 1rem;
      font-size: 0.85rem;
      display: flex;
      gap: 0.6rem;
      justify-content: center;
      align-items: center;
      flex-wrap: wrap;
      font-weight: 500;
    "
  >
    <span
      v-if="props.badge"
      style="
        background: rgba(255, 255, 255, 0.22);
        padding: 0.12rem 0.6rem;
        border-radius: 999px;
        font-weight: 700;
        font-size: 0.75rem;
        letter-spacing: 0.02em;
      "
    >
      {{ props.badge }}
    </span>
    <span>{{ props.text }}</span>
  </div>
</template>
