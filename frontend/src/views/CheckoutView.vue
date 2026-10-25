<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircle2, ArrowLeft } from 'lucide-vue-next';
import { productName } from '../data/products';
import { useCartStore } from '../stores/cart';
import { api, apiErrorMessage } from '../services/api';
import { resolveKhqrImageSource } from '../paymentQr';

const { t, locale } = useI18n();
const cart = useCartStore();
const busy = ref(false);
const error = ref('');
const orderNumber = ref('');
const paymentMethod = ref<'CASH_ON_DELIVERY' | 'ABA_KHQR'>('CASH_ON_DELIVERY');
const orderPaymentMethod = ref<'CASH_ON_DELIVERY' | 'ABA_KHQR'>('CASH_ON_DELIVERY');
const paymentQrImage = ref<string | null>(null);
const paymentError = ref('');
const paymentStatus = ref<'PENDING' | 'PAID'>('PENDING');
const retryingQr = ref(false);
const paymentTotal = ref(0);
let paymentPollTimer: number | undefined;
let paymentPollAttempts = 0;
const maxPaymentPollAttempts = 60;
const form = reactive({ customerName: '', customerEmail: '', customerPhone: '', addressLine: '', city: '', province: '', notes: '' });
const delivery = computed(() => cart.subtotal >= 50 ? 0 : 2.5);
const total = computed(() => cart.subtotal + delivery.value);
const money = (value: number) => new Intl.NumberFormat(locale.value === 'km' ? 'km-KH' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);

function stopPaymentPolling() {
  if (paymentPollTimer !== undefined) window.clearTimeout(paymentPollTimer);
  paymentPollTimer = undefined;
}

function schedulePaymentPoll() {
  if (paymentPollAttempts >= maxPaymentPollAttempts || paymentStatus.value === 'PAID') return;
  paymentPollTimer = window.setTimeout(() => void pollPaymentStatus(), 10000);
}

async function pollPaymentStatus() {
  if (!orderNumber.value || orderPaymentMethod.value !== 'ABA_KHQR' || paymentStatus.value === 'PAID') return;
  paymentPollAttempts += 1;
  try {
    const { data } = await api.post(`/payments/aba/${encodeURIComponent(orderNumber.value)}/status`, { customerPhone: form.customerPhone });
    if (data.data.confirmed) {
      paymentStatus.value = 'PAID';
      stopPaymentPolling();
      return;
    }
  } catch {
    // Keep the payment pending while the provider is temporarily unavailable.
  }
  schedulePaymentPoll();
}

function startPaymentPolling() {
  stopPaymentPolling();
  paymentPollAttempts = 0;
  schedulePaymentPoll();
}

async function retryKhqr() {
  retryingQr.value = true;
  paymentError.value = '';
  try {
    const { data } = await api.post(`/payments/aba/${encodeURIComponent(orderNumber.value)}/khqr`, { customerPhone: form.customerPhone });
    paymentQrImage.value = resolveKhqrImageSource(data.data.khqr?.qrImage);
    if (!paymentQrImage.value) throw new Error(t('checkout.qrInvalid'));
    paymentStatus.value = 'PENDING';
    startPaymentPolling();
  } catch (exception) {
    paymentError.value = apiErrorMessage(exception) || t('checkout.qrCreateFailed');
  } finally {
    retryingQr.value = false;
  }
}

onBeforeUnmount(stopPaymentPolling);

async function placeOrder() {
  error.value = '';
  if (!form.customerName || !form.customerPhone || !form.addressLine || !form.city || !form.province || !cart.lines.length) {
    error.value = t('checkout.required');
    return;
  }
  busy.value = true;
  try {
    const { data } = await api.post('/orders', { ...form, paymentMethod: paymentMethod.value, items: cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })) });
    const order = data.data.order;
    orderNumber.value = order.orderNumber;
    paymentTotal.value = Number(order.total ?? total.value);
    orderPaymentMethod.value = order.paymentMethod ?? paymentMethod.value;
    paymentError.value = data.data.paymentError || '';
    paymentQrImage.value = resolveKhqrImageSource(data.data.khqr?.qrImage);
    paymentStatus.value = 'PENDING';
    if (orderPaymentMethod.value === 'ABA_KHQR') {
      if (paymentQrImage.value) startPaymentPolling();
      else if (!paymentError.value) paymentError.value = t('checkout.qrCreateFailed');
    }

    cart.clear();
  } catch (exception) {
    error.value = apiErrorMessage(exception) || t('checkout.failed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="checkout-page page-wrap">
    <RouterLink to="/cart" class="back-link"><ArrowLeft :size="16" /> {{ t('cart.title') }}</RouterLink>
    <div v-if="orderNumber" class="checkout-success"><span class="success-symbol"><CheckCircle2 :size="30" /></span><span class="section-kicker">{{ t('checkout.thanks') }}</span><h1>{{ t('checkout.success') }}</h1><p>{{ t('checkout.orderNumber') }}: <strong>{{ orderNumber }}</strong></p><div v-if="orderPaymentMethod === 'ABA_KHQR'" class="payment-qr-box"><p>{{ t('checkout.payNow') }}</p><img v-if="paymentQrImage" :src="paymentQrImage" :alt="t('checkout.qrAlt')" class="payment-qr-image" /><div v-else class="qr-generation-error" role="alert"><p>{{ paymentError || t('checkout.qrCreateFailed') }}</p><button class="button button-outline" type="button" :disabled="retryingQr" @click="retryKhqr">{{ retryingQr ? t('checkout.qrRetrying') : t('checkout.qrRetry') }}</button></div><p>{{ t('checkout.totalDue') }}: <strong>{{ money(paymentTotal) }}</strong></p><small>{{ t('checkout.qrHint', { orderNumber, amount: money(paymentTotal) }) }}</small><span class="payment-status-badge" :class="paymentStatus.toLowerCase()"><i></i>{{ paymentStatus === 'PAID' ? t('checkout.paymentVerified') : t('checkout.paymentPending') }}</span></div><p v-else>{{ t('checkout.codHint') }}</p><RouterLink to="/shop" class="button button-dark">{{ t('cart.keepShopping') }}</RouterLink></div>
    <div v-else-if="!cart.lines.length" class="empty-state"><p>{{ t('cart.empty') }}</p><RouterLink to="/shop" class="button button-dark">{{ t('cart.emptyAction') }}</RouterLink></div>
    <div v-else class="checkout-layout">
      <form class="checkout-form" @submit.prevent="placeOrder"><span class="section-kicker">{{ t('checkout.eyebrow') }}</span><h1>{{ t('checkout.title') }}</h1><h2>{{ t('checkout.details') }}</h2>
        <div class="form-grid"><label class="form-field span-two"><span>{{ t('checkout.name') }} *</span><input v-model.trim="form.customerName" autocomplete="name" required maxlength="100" /></label><label class="form-field"><span>{{ t('checkout.email') }}</span><input v-model.trim="form.customerEmail" type="email" autocomplete="email" /></label><label class="form-field"><span>{{ t('checkout.phone') }} *</span><input v-model.trim="form.customerPhone" type="tel" autocomplete="tel" required minlength="6" maxlength="30" /></label><label class="form-field span-two"><span>{{ t('checkout.address') }} *</span><input v-model.trim="form.addressLine" autocomplete="street-address" required maxlength="240" /></label><label class="form-field"><span>{{ t('checkout.city') }} *</span><input v-model.trim="form.city" required /></label><label class="form-field"><span>{{ t('checkout.province') }} *</span><input v-model.trim="form.province" required /></label><label class="form-field span-two"><span>{{ t('checkout.notes') }}</span><textarea v-model.trim="form.notes" rows="3" maxlength="500"></textarea></label></div>
        <fieldset class="payment-choice"><legend>{{ t('checkout.payment') }}</legend><label><input v-model="paymentMethod" type="radio" name="payment" value="CASH_ON_DELIVERY" /><span><strong>{{ t('checkout.cod') }}</strong><small>{{ t('checkout.codHint') }}</small></span></label><label><input v-model="paymentMethod" type="radio" name="payment" value="ABA_KHQR" /><span><strong>{{ t('checkout.aba') }}</strong><small>{{ t('checkout.abaHint') }}</small></span></label></fieldset>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p><button class="button button-dark checkout-submit" type="submit" :disabled="busy">{{ busy ? t('checkout.placing') : t('checkout.place') }}</button>
      </form>
      <aside class="order-summary checkout-summary"><h2>{{ t('cart.title') }}</h2><div v-for="line in cart.lines" :key="line.product.id" class="checkout-item"><img :src="line.product.images[0]" :alt="productName(line.product, locale)" /><div><strong>{{ productName(line.product, locale) }}</strong><span>{{ line.quantity }} × {{ money(line.product.price) }}</span></div><b>{{ money(line.product.price * line.quantity) }}</b></div><div class="summary-row"><span>{{ t('cart.subtotal') }}</span><span>{{ money(cart.subtotal) }}</span></div><div class="summary-row"><span>{{ t('cart.delivery') }}</span><span>{{ delivery ? money(delivery) : t('cart.free') }}</span></div><div class="summary-total"><span>{{ t('cart.total') }}</span><strong>{{ money(total) }}</strong></div></aside>
    </div>
  </section>
</template>

<style scoped>
.payment-qr-box {
  width: min(100%, 500px);
  margin-top: 1rem;
  padding: 1rem;
  border: 1px solid rgba(85, 112, 91, 0.25);
  border-radius: 14px;
  background: rgba(85, 112, 91, 0.04);
  display: grid;
  justify-items: center;
  gap: 0.5rem;
  text-align: center;
}

.payment-qr-image {
  display: block;
  width: min(380px, 100%);
  height: auto;
  aspect-ratio: 1;
  object-fit: contain;
  border-radius: 12px;
  background: #fff;
  padding: .75rem;
  box-shadow: 0 10px 30px rgba(18, 24, 20, 0.08);
}

.qr-generation-error { display: grid; justify-items: center; gap: .75rem; max-width: 380px; border: 1px solid #bd6846; padding: 14px; color: #8f432d; background: #fff8f4; font-size: 11px; line-height: 1.6; }
.qr-generation-error p { margin: 0; }
.payment-status-badge { display: inline-flex; align-items: center; gap: 6px; border-radius: 2px; padding: 5px 8px; color: #8b6b22; background: #f4eddb; font-size: 9px; font-weight: 700; }
.payment-status-badge i { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.payment-status-badge.paid { color: #466e56; background: #e5eee7; }
</style>