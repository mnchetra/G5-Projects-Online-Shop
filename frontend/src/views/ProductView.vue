<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { ArrowLeft, Check, Minus, Plus, Truck } from 'lucide-vue-next';
import ProductCard from '../components/ProductCard.vue';
import { productDescription, productName, products, type Product } from '../data/products';
import { useCartStore } from '../stores/cart';
import { api } from '../services/api';

const route = useRoute();
const { t, locale } = useI18n();
const cart = useCartStore();
const item = ref<Product | undefined>(products.find((product) => product.slug === route.params.slug));
const selectedImage = ref(0);
const quantity = ref(1);
const justAdded = ref(false);

onMounted(async () => {
  try {
    const { data } = await api.get(`/products/${route.params.slug}`);
    const record = data.data;
    item.value = { ...record, featured: record.isFeatured, category: record.category.slug, images: record.images.map((image: { url: string }) => image.url) };
  } catch { /* Keep the local sample product visible without a configured API. */ }
});

const name = computed(() => item.value ? productName(item.value, locale.value) : '');
const description = computed(() => item.value ? productDescription(item.value, locale.value) : '');
const related = computed(() => products.filter((product) => product.category === item.value?.category && product.slug !== item.value?.slug).slice(0, 3));
const formattedPrice = computed(() => item.value ? new Intl.NumberFormat(locale.value === 'km' ? 'km-KH' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(item.value.price) : '');

function addToCart() {
  if (!item.value) return;
  cart.add(item.value, quantity.value);
  justAdded.value = true;
  window.setTimeout(() => { justAdded.value = false; }, 1800);
}
</script>

<template>
  <section v-if="item" class="product-detail page-wrap">
    <RouterLink to="/shop" class="back-link"><ArrowLeft :size="16" /> {{ t('product.back') }}</RouterLink>
    <div class="product-detail-grid">
      <div class="gallery"><div class="gallery-main"><img :src="item.images[selectedImage]" :alt="name" /></div><div v-if="item.images.length > 1" class="gallery-thumbs"><button v-for="(image, index) in item.images" :key="image" type="button" :class="{ selected: selectedImage === index }" :aria-label="`View image ${index + 1}`" @click="selectedImage = index"><img :src="image" :alt="name" /></button></div></div>
      <div class="detail-copy"><span class="section-kicker">{{ t(`categories.${item.category}`) }} · {{ item.sku }}</span><h1>{{ name }}</h1><div class="detail-price">{{ formattedPrice }}</div><p class="detail-description">{{ description }}</p><div class="stock-note"><span class="stock-dot" :class="{ 'out-of-stock': item.stock < 1 }"></span>{{ item.stock > 0 ? t('product.stock', { count: item.stock }) : t('product.outOfStock') }}</div>
        <div class="purchase-row"><div class="quantity-stepper"><button type="button" :aria-label="t('product.quantity') + ' -'" :disabled="quantity <= 1" @click="quantity--"><Minus :size="15" /></button><span>{{ quantity }}</span><button type="button" :aria-label="t('product.quantity') + ' +'" :disabled="quantity >= item.stock" @click="quantity++"><Plus :size="15" /></button></div><button class="button button-dark add-button" type="button" :disabled="item.stock < 1" @click="addToCart">{{ justAdded ? t('product.added') : t('product.add') }} <Check v-if="justAdded" :size="17" /></button></div>
        <div class="detail-delivery"><Truck :size="18" /><div><strong>{{ t('product.delivery') }}</strong><span>{{ t('product.deliveryText') }}</span></div></div>
        <div class="product-detail-note"><h3>{{ t('product.details') }}</h3><p>{{ description }}</p></div>
      </div>
    </div>
    <section v-if="related.length" class="related-section"><div class="section-heading"><div><span class="section-kicker">{{ t('product.relatedKicker') }}</span><h2>{{ t('product.related') }}</h2></div></div><div class="product-grid"><ProductCard v-for="product in related" :key="product.id" :product="product" /></div></section>
  </section>
  <section v-else class="page-wrap empty-state"><p>{{ t('common.loading') }}</p></section>
</template>