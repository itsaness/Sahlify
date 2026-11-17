<script setup lang="ts">
const sectionProps = defineProps<{
  props: {
    title?: string;
    subtitle?: string;
    columns?: number;
    limit?: number;
    showSearch?: boolean;
    badgeText?: string;
  };
  products: any[];
}>();

const search = ref("");
const sortBy = ref<"newest" | "price_asc" | "price_desc">("newest");

const visibleProducts = computed(() => {
  let list = [...(sectionProps.products || [])];
  const q = search.value.trim().toLowerCase();
  if (q) {
    list = list.filter((p) => String(p.title || "").toLowerCase().includes(q));
  }
  if (sortBy.value === "price_asc") {
    list.sort((a, b) => Number(a.price_dzd) - Number(b.price_dzd));
  } else if (sortBy.value === "price_desc") {
    list.sort((a, b) => Number(b.price_dzd) - Number(a.price_dzd));
  }
  return list.slice(0, sectionProps.props.limit || 12);
});

function discountPercent(p: any) {
  if (!p.compare_at_dzd || p.compare_at_dzd <= p.price_dzd) return 0;
  return Math.round(((p.compare_at_dzd - p.price_dzd) / p.compare_at_dzd) * 100);
}
</script>

<template>
  <section id="products" style="max-width: 1160px; margin: 0 auto; padding: 3rem 1.5rem">
    <div
      style="
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        flex-wrap: wrap;
        gap: 1rem;
        margin-bottom: 1.75rem;
      "
    >
      <div>
        <h2 v-if="props.title" style="font-size: 1.65rem; font-weight: 800; margin: 0">
          {{ props.title }}
        </h2>
        <p v-if="props.subtitle" style="color: var(--c-muted); margin: 0.35rem 0 0; font-size: 0.95rem">
          {{ props.subtitle }}
        </p>
      </div>

      <div
        v-if="props.showSearch !== false && (products?.length || 0) > 3"
        style="display: flex; gap: 0.6rem; flex-wrap: wrap"
      >
        <input
          v-model="search"
          type="search"
          placeholder="🔍"
          aria-label="Search products"
          style="
            padding: 0.5rem 0.8rem;
            border-radius: var(--radius);
            border: 1px solid rgba(128, 128, 128, 0.25);
            background: var(--c-surface);
            color: var(--c-text);
            min-width: 170px;
          "
        />
        <select
          v-model="sortBy"
          aria-label="Sort products"
          style="
            padding: 0.5rem 0.75rem;
            border-radius: var(--radius);
            border: 1px solid rgba(128, 128, 128, 0.25);
            background: var(--c-surface);
            color: var(--c-text);
          "
        >
          <option value="newest">★</option>
          <option value="price_asc">↑ DZD</option>
          <option value="price_desc">↓ DZD</option>
        </select>
      </div>
    </div>

    <div
      class="product-grid"
      :style="{ '--cols': String(props.columns || 3) }"
    >
      <NuxtLink
        v-for="p in visibleProducts"
        :key="p.id"
        :to="`/products/${p.slug}`"
        class="product-card"
        style="
          background: var(--c-surface);
          border: var(--card-border);
          box-shadow: var(--card-shadow);
          border-radius: var(--radius);
          overflow: hidden;
          text-decoration: none;
          color: inherit;
          display: flex;
          flex-direction: column;
        "
      >
        <div
          style="
            position: relative;
            aspect-ratio: 1 / 1;
            background: rgba(128, 128, 128, 0.08);
            overflow: hidden;
          "
        >
          <img
            v-if="p.images?.[0]?.url"
            :src="p.images[0].url"
            :alt="p.title"
            class="product-img"
            style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s ease"
          />
          <span
            v-if="discountPercent(p) > 0"
            style="
              position: absolute;
              top: 0.65rem;
              inset-inline-start: 0.65rem;
              background: #dc2626;
              color: #ffffff;
              padding: 0.2rem 0.55rem;
              border-radius: 999px;
              font-size: 0.75rem;
              font-weight: 800;
            "
          >
            -{{ discountPercent(p) }}%
          </span>
          <span
            v-else-if="props.badgeText"
            style="
              position: absolute;
              top: 0.65rem;
              inset-inline-start: 0.65rem;
              background: var(--c-primary);
              color: #ffffff;
              padding: 0.2rem 0.55rem;
              border-radius: 999px;
              font-size: 0.75rem;
              font-weight: 700;
            "
          >
            {{ props.badgeText }}
          </span>
        </div>

        <div style="padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; flex: 1">
          <div style="font-weight: 700; font-size: 1.02rem; line-height: 1.35">{{ p.title }}</div>
          <div style="margin-top: auto; display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem">
            <div style="color: var(--c-primary); font-weight: 800; font-size: 1.08rem">
              {{ Number(p.price_dzd).toLocaleString() }} DZD
              <span
                v-if="p.compare_at_dzd"
                style="
                  color: var(--c-muted);
                  text-decoration: line-through;
                  font-weight: 400;
                  font-size: 0.84rem;
                  margin-inline-start: 0.35rem;
                "
              >
                {{ Number(p.compare_at_dzd).toLocaleString() }} DZD
              </span>
            </div>
            <span
              style="
                font-size: 0.78rem;
                font-weight: 700;
                padding: 0.25rem 0.6rem;
                border-radius: 999px;
                background: color-mix(in srgb, var(--c-primary) 12%, transparent);
                color: var(--c-primary);
              "
            >
              +
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.product-grid {
  display: grid;
  gap: 1.25rem;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}
@media (min-width: 900px) {
  .product-grid {
    grid-template-columns: repeat(var(--cols, 3), minmax(0, 1fr));
  }
}
.product-card:hover .product-img {
  transform: scale(1.04);
}
</style>
