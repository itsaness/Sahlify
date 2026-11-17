<script setup lang="ts">
import BannerSection from "~/components/sections/BannerSection.vue";
import HeroSection from "~/components/sections/HeroSection.vue";
import TrustBadgesSection from "~/components/sections/TrustBadgesSection.vue";
import ProductGridSection from "~/components/sections/ProductGridSection.vue";
import FaqSection from "~/components/sections/FaqSection.vue";
import ReviewsSection from "~/components/sections/ReviewsSection.vue";
import PromoSplitSection from "~/components/sections/PromoSplitSection.vue";
import CountdownSection from "~/components/sections/CountdownSection.vue";

const apiBase = useApiBase();
const { reqHeaders, preview } = useStorefrontHeaders();
const query = preview ? { preview } : undefined;

const { themeData } = await useStorefrontData();
const hostKey = reqHeaders["X-Store-Host"] || "default";
const { data: productsData } = await useFetch<{ products: any[] }>(
  `${apiBase}/api/storefront/products`,
  { key: `sf-products:${hostKey}:${preview || ""}`, headers: reqHeaders, query }
);

const sections = computed(() => themeData.value?.theme?.pages?.home?.sections || []);
const products = computed(() => productsData.value?.products || []);

const componentMap: Record<string, any> = {
  banner: BannerSection,
  hero: HeroSection,
  trust_badges: TrustBadgesSection,
  product_grid: ProductGridSection,
  faq: FaqSection,
  reviews: ReviewsSection,
  promo_split: PromoSplitSection,
  countdown: CountdownSection,
};
</script>

<template>
  <div>
    <component
      :is="componentMap[section.type]"
      v-for="(section, idx) in sections"
      :key="idx"
      :props="section.props"
      :products="products"
    />
  </div>
</template>
