<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Trash2, ArrowRight, ShoppingBasket } from 'lucide-vue-next';
import { productName } from '../data/products';
import { useCartStore } from '../stores/cart';

const { t, locale } = useI18n();
const cart = useCartStore();
const delivery = computed(() => cart.subtotal >= 50 || cart.subtotal === 0 ? 0 : 2.5);
const total = computed(() => cart.subtotal + delivery.value);
const money = (value: number) => new Intl.NumberFormat(locale.value === 'km' ? 'km-KH' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
</script>

<template>
  <section class="cart-page page-wrap">
    <div class="cart-heading"><span class="section-kicker">{{ t('home.featuredKicker') }}</span><h1>{{ t('cart.title') }}</h1><span v-if="cart.count" class="cart-count-label">{{ cart.count }} {{ t('common.items') }}</span></div>
    <div v-if="!cart.lines.length" class="empty-state cart-empty"><span class="empty-icon"><ShoppingBasket :size="23" /></span><h2>{{ t('cart.empty') }}</h2><RouterLink to="/shop" class="button button-dark">{{ t('cart.emptyAction') }} <ArrowRight :size="17" /></RouterLink></div>
    <div v-else class="cart-layout">
      <div class="cart-lines"><div v-for="line in cart.lines" :key="line.product.id" class="cart-line"><RouterLink :to="`/product/${line.product.slug}`" class="cart-line-image"><img :src="line.product.images[0]" :alt="productName(line.product, locale)" /></RouterLink><div class="cart-line-info"><span class="section-kicker">{{ line.product.category.replace('-', ' ') }}</span><RouterLink :to="`/product/${line.product.slug}`" class="cart-line-name">{{ productName(line.product, locale) }}</RouterLink><span class="cart-line-price">{{ money(line.product.price) }}</span><button class="remove-line" type="button" @click="cart.remove(line.product.id)"><Trash2 :size="14" /> {{ t('cart.remove') }}</button></div><div class="cart-line-controls"><div class="quantity-stepper"><button type="button" :aria-label="`Decrease ${productName(line.product, locale)} quantity`" :disabled="line.quantity <= 1" @click="cart.setQuantity(line.product.id, line.quantity - 1)">−</button><span>{{ line.quantity }}</span><button type="button" :aria-label="`Increase ${productName(line.product, locale)} quantity`" :disabled="line.quantity >= line.product.stock" @click="cart.setQuantity(line.product.id, line.quantity + 1)">+</button></div><strong>{{ money(line.product.price * line.quantity) }}</strong></div></div></div>
      <aside class="order-summary"><h2>{{ t('cart.title') }}</h2><div class="summary-row"><span>{{ t('cart.subtotal') }}</span><span>{{ money(cart.subtotal) }}</span></div><div class="summary-row"><span>{{ t('cart.delivery') }}</span><span>{{ delivery ? money(delivery) : t('cart.free') }}</span></div><div class="summary-total"><span>{{ t('cart.total') }}</span><strong>{{ money(total) }}</strong></div><p v-if="cart.subtotal < 50" class="delivery-hint">{{ t('cart.deliveryHint', { amount: money(50 - cart.subtotal) }) }}</p><RouterLink to="/checkout" class="button button-dark summary-button">{{ t('cart.checkout') }} <ArrowRight :size="17" /></RouterLink><RouterLink to="/shop" class="continue-link">{{ t('cart.keepShopping') }}</RouterLink></aside>
    </div>
  </section>
</template>