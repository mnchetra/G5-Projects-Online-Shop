<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ShoppingBag } from 'lucide-vue-next';
import type { Product } from '../data/products';
import { productName } from '../data/products';
import { useCartStore } from '../stores/cart';

const props = defineProps<{ product: Product; label?: string }>();
const { locale, t } = useI18n();
const cart = useCartStore();
const name = computed(() => productName(props.product, locale.value));
const price = computed(() => new Intl.NumberFormat(locale.value === 'km' ? 'km-KH' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(props.product.price));
</script>

<template>
  <article class="product-card">
    <RouterLink :to="`/product/${product.slug}`" class="product-image-wrap">
      <img :src="product.images[0]" :alt="name" loading="lazy" />
      <span v-if="label" class="product-label">{{ label }}</span>
    </RouterLink>
    <div class="product-card-meta"><span>{{ t(`categories.${product.category}`) }}</span><button class="quick-add" type="button" :aria-label="t('product.add')" :disabled="product.stock < 1" @click="cart.add(product)"><ShoppingBag :size="17" /></button></div>
    <RouterLink :to="`/product/${product.slug}`" class="product-name">{{ name }}</RouterLink>
    <div class="product-price">{{ price }}</div>
  </article>
</template>