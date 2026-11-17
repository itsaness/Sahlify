<script setup lang="ts">
const route = useRoute();
const apiBase = useApiBase();
const { reqHeaders, preview } = useStorefrontHeaders();
const query = preview ? { preview } : undefined;

const { storeData, themeData } = await useStorefrontData();
const store = computed(() => storeData.value?.store);
const showRelated = computed(() => themeData.value?.theme?.pages?.product?.showRelated !== false);
const hostKey = reqHeaders["X-Store-Host"] || "default";
const keySuffix = `${hostKey}:${preview || ""}`;

const [{ data, error }, { data: wilayasData }, { data: ratesData }, { data: allProductsData }] =
  await Promise.all([
    useFetch<{ product: any }>(`${apiBase}/api/storefront/products/${route.params.slug}`, {
      key: `sf-product:${route.params.slug}:${keySuffix}`,
      headers: reqHeaders,
      query,
    }),
    useFetch<{ wilayas: any[] }>(`${apiBase}/api/wilayas`, { key: "sf-wilayas" }),
    useFetch<{ rates: any[] }>(`${apiBase}/api/storefront/shipping-rates`, {
      key: `sf-rates:${keySuffix}`,
      headers: reqHeaders,
      query,
    }),
    useFetch<{ products: any[] }>(`${apiBase}/api/storefront/products?limit=8`, {
      key: `sf-related:${keySuffix}`,
      headers: reqHeaders,
      query,
    }),
  ]);

const product = computed(() => data.value?.product);
const wilayas = computed(() => wilayasData.value?.wilayas || []);
const rates = computed(() => ratesData.value?.rates || []);
const relatedProducts = computed(() =>
  (allProductsData.value?.products || [])
    .filter((p) => p.id !== product.value?.id)
    .slice(0, 4)
);

const activeImageIdx = ref(0);
const selectedVariantId = ref<string | null>(null);
const qty = ref(1);
const customerName = ref("");
const phone = ref("");
const wilayaId = ref<number | null>(16);
const deliveryType = ref<"home" | "stopdesk">("home");
const paymentMethod = ref<"cod" | "edahabia" | "cib">("cod");
const address = ref("");
const submitting = ref(false);
const submitError = ref("");
const placedOrder = ref<any>(null);

watch(
  product,
  (p) => {
    activeImageIdx.value = 0;
    if (p?.variants?.length && !selectedVariantId.value) {
      selectedVariantId.value = p.variants[0].id;
    }
  },
  { immediate: true }
);

const activeImageUrl = computed(
  () => product.value?.images?.[activeImageIdx.value]?.url || product.value?.images?.[0]?.url || ""
);

const unitPrice = computed(() => {
  if (!product.value) return 0;
  const v = product.value.variants?.find((x: any) => x.id === selectedVariantId.value);
  return v?.price_dzd ?? product.value.price_dzd;
});

const discountPercent = computed(() => {
  const p = product.value;
  if (!p?.compare_at_dzd || p.compare_at_dzd <= unitPrice.value) return 0;
  return Math.round(((p.compare_at_dzd - unitPrice.value) / p.compare_at_dzd) * 100);
});

const shippingFee = computed(() => {
  const r = rates.value.find((x: any) => x.wilaya_id === wilayaId.value);
  if (!r) return 0;
  return deliveryType.value === "stopdesk" ? r.stopdesk_price_dzd : r.home_price_dzd;
});

const totalDzd = computed(() => unitPrice.value * qty.value + shippingFee.value);

const submitLabel = computed(() => {
  if (submitting.value) return "جاري إرسال الطلب...";
  if (paymentMethod.value === "cod") {
    return `تأكيد الطلب (${Number(totalDzd.value).toLocaleString()} DZD)`;
  }
  return `المتابعة للدفع الإلكتروني (${Number(totalDzd.value).toLocaleString()} DZD)`;
});

function scrollToCheckout() {
  if (!import.meta.client) return;
  document.getElementById("checkout-form")?.scrollIntoView({ behavior: "smooth" });
}

function getCookie(name: string) {
  if (!import.meta.client) return undefined;
  const match = document.cookie.match(new RegExp(`(^| )${name}=([^;]+)`));
  return match ? decodeURIComponent(match[2]) : undefined;
}

async function submitOrder() {
  if (!product.value || !wilayaId.value) return;
  submitting.value = true;
  submitError.value = "";
  try {
    const res = await $fetch<{ order: any; checkoutUrl?: string | null; leadEventId: string }>(
      `${apiBase}/api/storefront/orders${preview ? `?preview=${encodeURIComponent(preview)}` : ""}`,
      {
        method: "POST",
        headers: reqHeaders,
        body: {
          customerName: customerName.value,
          phone: phone.value,
          wilayaId: wilayaId.value,
          deliveryType: deliveryType.value,
          address: address.value,
          paymentMethod: paymentMethod.value,
          items: [
            {
              productId: product.value.id,
              variantId: selectedVariantId.value,
              qty: qty.value,
            },
          ],
          fbp: getCookie("_fbp"),
          fbc: getCookie("_fbc"),
          eventSourceUrl: import.meta.client ? window.location.href : undefined,
        },
      }
    );
    if (import.meta.client && (window as any).fbq) {
      (window as any).fbq(
        "track",
        "Lead",
        { currency: "DZD", value: res.order.subtotal_dzd },
        { eventID: res.leadEventId }
      );
    }
    if (res.checkoutUrl && import.meta.client) {
      window.location.href = res.checkoutUrl;
      return;
    }
    placedOrder.value = res.order;
  } catch (err: any) {
    submitError.value = err?.data?.message || "تعذر إرسال الطلب";
  } finally {
    submitting.value = false;
  }
}

useHead(() => {
  if (!product.value) return {};
  return {
    title: product.value.title,
    meta: [
      { property: "og:title", content: product.value.title },
      { property: "og:description", content: (product.value.description || "").slice(0, 160) },
      ...(product.value.images?.[0]?.url
        ? [{ property: "og:image", content: product.value.images[0].url }]
        : []),
    ],
  };
});
</script>

<template>
  <section style="max-width: 1140px; margin: 0 auto; padding: 2.5rem 1.5rem 5rem">
    <div v-if="error || !product" style="text-align: center; padding: 3rem 0">
      <h1>المنتج غير موجود</h1>
      <NuxtLink to="/">العودة للمتجر</NuxtLink>
    </div>

    <template v-else>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2.5rem; align-items: start">
        <!-- Multi-Image Gallery -->
        <div style="display: grid; gap: 0.85rem">
          <div style="position: relative; border-radius: var(--radius); overflow: hidden; background: var(--c-surface); border: var(--card-border)">
            <img
              v-if="activeImageUrl"
              :src="activeImageUrl"
              :alt="product.title"
              style="width: 100%; aspect-ratio: 1 / 1; object-fit: cover; display: block"
            />
            <span
              v-if="discountPercent > 0"
              style="
                position: absolute;
                top: 0.85rem;
                inset-inline-start: 0.85rem;
                background: #dc2626;
                color: #ffffff;
                padding: 0.25rem 0.65rem;
                border-radius: 999px;
                font-size: 0.8rem;
                font-weight: 800;
              "
            >
              -{{ discountPercent }}%
            </span>
          </div>

          <div v-if="product.images?.length > 1" style="display: flex; gap: 0.6rem; flex-wrap: wrap">
            <button
              v-for="(img, idx) in product.images"
              :key="img.id || idx"
              type="button"
              @click="activeImageIdx = idx"
              :style="{
                border: idx === activeImageIdx ? '2px solid var(--c-primary)' : '1px solid rgba(128,128,128,0.2)',
                opacity: idx === activeImageIdx ? 1 : 0.7,
              }"
              style="width: 68px; height: 68px; padding: 0; border-radius: 8px; overflow: hidden; cursor: pointer; background: none"
            >
              <img :src="img.url" :alt="product.title" style="width: 100%; height: 100%; object-fit: cover" />
            </button>
          </div>
        </div>

        <!-- Product Info & Express Checkout -->
        <div>
          <h1 style="font-size: clamp(1.5rem, 3vw, 2rem); font-weight: 800; margin: 0 0 0.75rem">
            {{ product.title }}
          </h1>

          <div style="display: flex; align-items: baseline; gap: 0.65rem; margin-bottom: 1.15rem">
            <span style="font-size: 1.65rem; font-weight: 800; color: var(--c-primary)">
              {{ Number(unitPrice).toLocaleString() }} DZD
            </span>
            <span
              v-if="product.compare_at_dzd"
              style="color: var(--c-muted); text-decoration: line-through; font-size: 1.05rem"
            >
              {{ Number(product.compare_at_dzd).toLocaleString() }} DZD
            </span>
          </div>

          <p v-if="product.description" style="color: var(--c-muted); white-space: pre-line; line-height: 1.7; margin: 0 0 1.5rem">
            {{ product.description }}
          </p>

          <div
            v-if="placedOrder"
            style="
              background: #ecfdf5;
              border: 1px solid #10b981;
              color: #065f46;
              border-radius: var(--radius);
              padding: 1.5rem;
            "
          >
            <h3 style="margin-top: 0">تم استلام طلبك بنجاح (#{{ placedOrder.order_number }})</h3>
            <p style="margin-bottom: 0">
              سنتصل بك لتأكيد الطلبية. المجموع: <strong>{{ Number(placedOrder.total_dzd).toLocaleString() }} DZD</strong>
            </p>
          </div>

          <form
            v-else
            id="checkout-form"
            @submit.prevent="submitOrder"
            style="
              background: var(--c-surface);
              border: var(--card-border);
              box-shadow: var(--card-shadow);
              border-radius: var(--radius);
              padding: 1.35rem;
              display: grid;
              gap: 0.9rem;
            "
          >
            <div v-if="product.variants?.length">
              <label style="display: block; font-weight: 700; margin-bottom: 0.45rem; font-size: 0.9rem">
                الخيار / المقاس
              </label>
              <div style="display: flex; flex-wrap: wrap; gap: 0.5rem">
                <button
                  v-for="v in product.variants"
                  :key="v.id"
                  type="button"
                  @click="selectedVariantId = v.id"
                  :style="{
                    border: selectedVariantId === v.id ? '2px solid var(--c-primary)' : '1px solid rgba(128,128,128,0.28)',
                    background: selectedVariantId === v.id ? 'color-mix(in srgb, var(--c-primary) 12%, transparent)' : 'transparent',
                    color: selectedVariantId === v.id ? 'var(--c-primary)' : 'var(--c-text)',
                  }"
                  style="padding: 0.45rem 0.9rem; border-radius: 999px; font-weight: 700; font-size: 0.85rem; cursor: pointer"
                >
                  {{ v.title }}
                </button>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem">
              <input
                v-model="customerName"
                required
                placeholder="الاسم الكامل"
                style="padding: 0.7rem; border-radius: 8px; border: 1px solid rgba(128,128,128,0.28); background: var(--c-bg); color: var(--c-text)"
              />
              <input
                v-model="phone"
                required
                placeholder="رقم الهاتف (05 / 06 / 07...)"
                style="padding: 0.7rem; border-radius: 8px; border: 1px solid rgba(128,128,128,0.28); background: var(--c-bg); color: var(--c-text)"
              />
            </div>

            <select
              v-model.number="wilayaId"
              required
              style="padding: 0.7rem; border-radius: 8px; border: 1px solid rgba(128,128,128,0.28); background: var(--c-bg); color: var(--c-text)"
            >
              <option v-for="w in wilayas" :key="w.id" :value="w.id">
                {{ w.code }} - {{ w.name_ar }} ({{ w.name_fr }})
              </option>
            </select>

            <div style="display: flex; gap: 1rem; flex-wrap: wrap">
              <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 600">
                <input v-model="deliveryType" type="radio" value="home" /> توصيل للمنزل
              </label>
              <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer; font-weight: 600">
                <input v-model="deliveryType" type="radio" value="stopdesk" /> مكتب التوصيل
              </label>
            </div>

            <div v-if="store?.online_payment_enabled" style="display: flex; gap: 1rem; flex-wrap: wrap">
              <label v-if="store?.cod_enabled !== false" style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer">
                <input v-model="paymentMethod" type="radio" value="cod" /> الدفع عند الاستلام
              </label>
              <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer">
                <input v-model="paymentMethod" type="radio" value="edahabia" /> البطاقة الذهبية (Chargily)
              </label>
              <label style="display: flex; align-items: center; gap: 0.35rem; cursor: pointer">
                <input v-model="paymentMethod" type="radio" value="cib" /> بطاقة CIB (Chargily)
              </label>
            </div>

            <input
              v-if="deliveryType === 'home'"
              v-model="address"
              placeholder="العنوان / البلدية"
              style="padding: 0.7rem; border-radius: 8px; border: 1px solid rgba(128,128,128,0.28); background: var(--c-bg); color: var(--c-text)"
            />

            <div style="display: flex; align-items: center; justify-content: space-between">
              <label style="font-weight: 700">الكمية</label>
              <div style="display: inline-flex; align-items: center; border: 1px solid rgba(128,128,128,0.28); border-radius: 8px; overflow: hidden">
                <button
                  type="button"
                  @click="qty = Math.max(1, qty - 1)"
                  style="padding: 0.4rem 0.85rem; background: none; border: none; color: inherit; font-weight: 800; cursor: pointer"
                >
                  −
                </button>
                <span style="padding: 0.4rem 0.9rem; font-weight: 700">{{ qty }}</span>
                <button
                  type="button"
                  @click="qty = Math.min(50, qty + 1)"
                  style="padding: 0.4rem 0.85rem; background: none; border: none; color: inherit; font-weight: 800; cursor: pointer"
                >
                  +
                </button>
              </div>
            </div>

            <div style="border-top: 1px solid rgba(128,128,128,0.16); padding-top: 0.85rem; font-size: 0.95rem; display: grid; gap: 0.3rem">
              <div style="display: flex; justify-content: space-between">
                <span style="color: var(--c-muted)">سعر المنتج</span>
                <span>{{ Number(unitPrice * qty).toLocaleString() }} DZD</span>
              </div>
              <div style="display: flex; justify-content: space-between">
                <span style="color: var(--c-muted)">التوصيل</span>
                <span>{{ Number(shippingFee).toLocaleString() }} DZD</span>
              </div>
              <div style="display: flex; justify-content: space-between; font-weight: 800; font-size: 1.15rem; margin-top: 0.25rem">
                <span>المجموع</span>
                <span style="color: var(--c-primary)">{{ Number(totalDzd).toLocaleString() }} DZD</span>
              </div>
            </div>

            <p v-if="submitError" style="color: #dc2626; margin: 0; font-weight: 600">{{ submitError }}</p>

            <button
              type="submit"
              :disabled="submitting"
              style="
                background: var(--c-primary);
                color: #ffffff;
                border: none;
                padding: 0.95rem;
                border-radius: var(--radius);
                font-weight: 800;
                font-size: 1rem;
                cursor: pointer;
                box-shadow: 0 10px 24px -10px color-mix(in srgb, var(--c-primary) 70%, transparent);
              "
            >
              {{ submitLabel }}
            </button>

            <div style="display: flex; justify-content: space-around; flex-wrap: wrap; gap: 0.5rem; font-size: 0.78rem; color: var(--c-muted); padding-top: 0.25rem">
              <span>✓ توصيل 69 ولاية</span>
              <span>✓ شحن سريع 24-72 ساعة</span>
              <span>✓ الدفع عند الاستلام</span>
            </div>
          </form>
        </div>
      </div>

      <!-- Related Products -->
      <div v-if="showRelated && relatedProducts.length > 0" style="margin-top: 4rem">
        <h2 style="font-size: 1.45rem; font-weight: 800; margin-bottom: 1.25rem">منتجات أخرى قد تعجبك</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 1.1rem">
          <NuxtLink
            v-for="rp in relatedProducts"
            :key="rp.id"
            :to="`/products/${rp.slug}`"
            style="
              background: var(--c-surface);
              border: var(--card-border);
              border-radius: var(--radius);
              overflow: hidden;
              text-decoration: none;
              color: inherit;
              display: flex;
              flex-direction: column;
            "
          >
            <div style="aspect-ratio: 1 / 1; background: rgba(128, 128, 128, 0.08)">
              <img
                v-if="rp.images?.[0]?.url"
                :src="rp.images[0].url"
                :alt="rp.title"
                style="width: 100%; height: 100%; object-fit: cover"
              />
            </div>
            <div style="padding: 0.85rem">
              <div style="font-weight: 700; margin-bottom: 0.25rem">{{ rp.title }}</div>
              <div style="color: var(--c-primary); font-weight: 800">{{ Number(rp.price_dzd).toLocaleString() }} DZD</div>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Sticky Mobile Order Bar -->
      <div v-if="!placedOrder" class="mobile-sticky-bar">
        <div>
          <div style="font-weight: 800; color: var(--c-primary)">{{ Number(totalDzd).toLocaleString() }} DZD</div>
          <div style="font-size: 0.72rem; color: var(--c-muted)">{{ product.title }}</div>
        </div>
        <button
          type="button"
          @click="scrollToCheckout"
          style="
            background: var(--c-primary);
            color: #ffffff;
            border: none;
            padding: 0.65rem 1.25rem;
            border-radius: var(--radius);
            font-weight: 800;
            cursor: pointer;
          "
        >
          اطلب الآن
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped>
.mobile-sticky-bar {
  display: none;
}
@media (max-width: 768px) {
  .mobile-sticky-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 45;
    background: var(--c-surface);
    border-top: 1px solid rgba(128, 128, 128, 0.18);
    padding: 0.7rem 1.15rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }
}
</style>
