<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckCircle2, ArrowLeft, ArrowRight, ShieldCheck, Lock, ExternalLink, LogIn, UserPlus, Sparkles, UserCheck, Eye, EyeOff } from 'lucide-vue-next';
import { productName } from '../data/products';
import { useCartStore } from '../stores/cart';
import { useAuthStore } from '../stores/auth';
import { api, apiErrorMessage } from '../services/api';
import { resolveKhqrImageSource } from '../paymentQr';

const { t, locale } = useI18n();
const cart = useCartStore();
const auth = useAuthStore();
const busy = ref(false);
const error = ref('');
const orderNumber = ref('');
const paymentMethod = ref<'CASH_ON_DELIVERY' | 'ABA_KHQR' | 'BAKONG_ESCROW'>('BAKONG_ESCROW');
const orderPaymentMethod = ref<'CASH_ON_DELIVERY' | 'ABA_KHQR' | 'BAKONG_ESCROW'>('BAKONG_ESCROW');
const paymentQrImage = ref<string | null>(null);
const paymentError = ref('');
const paymentStatus = ref<'PENDING' | 'PAID'>('PENDING');
const retryingQr = ref(false);
const paymentTotal = ref(0);
let paymentPollTimer: number | undefined;
let paymentPollAttempts = 0;
const maxPaymentPollAttempts = 60;

const form = reactive({ customerName: '', customerEmail: '', customerPhone: '', addressLine: '', city: '', province: '', notes: '' });

// In-page authentication gate state
const authMode = ref<'login' | 'register'>('login');
const authBusy = ref(false);
const authError = ref('');
const authSuccess = ref('');
const revealAuthPassword = ref(false);
const authForm = reactive({ name: '', email: '', phone: '', password: '' });

function syncUserToForm() {
  if (auth.user) {
    if (!form.customerName || form.customerName === '') form.customerName = auth.user.name;
    if (!form.customerEmail || form.customerEmail === '') form.customerEmail = auth.user.email;
    if ((!form.customerPhone || form.customerPhone === '') && auth.user.phone) form.customerPhone = auth.user.phone;
  }
}

watch(() => auth.user, () => syncUserToForm(), { immediate: true });

onMounted(async () => {
  if (!auth.checked) await auth.fetchMe();
  syncUserToForm();
});

async function handleCheckoutLogin() {
  authBusy.value = true;
  authError.value = '';
  authSuccess.value = '';
  try {
    await auth.login(authForm.email, authForm.password);
    syncUserToForm();
    authSuccess.value = t('checkout.signInSuccess');
  } catch (err) {
    authError.value = apiErrorMessage(err) || t('account.failed');
  } finally {
    authBusy.value = false;
  }
}

async function handleCheckoutRegister() {
  authBusy.value = true;
  authError.value = '';
  authSuccess.value = '';
  try {
    await auth.register({
      name: authForm.name,
      email: authForm.email,
      phone: authForm.phone,
      password: authForm.password
    });
    syncUserToForm();
    authSuccess.value = t('checkout.signInSuccess');
  } catch (err) {
    authError.value = apiErrorMessage(err) || t('account.failed');
  } finally {
    authBusy.value = false;
  }
}

async function handleQuickDemoCustomer() {
  authBusy.value = true;
  authError.value = '';
  authSuccess.value = '';
  authForm.email = 'customer@example.com';
  authForm.password = 'Customer12345!';
  try {
    await auth.login('customer@example.com', 'Customer12345!');
    syncUserToForm();
    authSuccess.value = t('checkout.signInSuccess');
  } catch (err) {
    authError.value = apiErrorMessage(err) || t('account.failed');
  } finally {
    authBusy.value = false;
  }
}

async function handleLogout() {
  await auth.logout();
  form.customerName = '';
  form.customerEmail = '';
  form.customerPhone = '';
}

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
  if (!orderNumber.value || (orderPaymentMethod.value !== 'ABA_KHQR' && orderPaymentMethod.value !== 'BAKONG_ESCROW') || paymentStatus.value === 'PAID') return;
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
  if (!auth.user) {
    error.value = t('checkout.mustSignInToBuy');
    return;
  }
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
    if (orderPaymentMethod.value === 'ABA_KHQR' || orderPaymentMethod.value === 'BAKONG_ESCROW') {
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
    <div v-if="orderNumber" class="checkout-success">
      <span class="success-symbol"><CheckCircle2 :size="30" /></span>
      <span class="section-kicker">{{ t('checkout.thanks') }}</span>
      <h1>{{ t('checkout.success') }}</h1>
      <p>{{ t('checkout.orderNumber') }}: <strong>{{ orderNumber }}</strong></p>

      <div v-if="orderPaymentMethod === 'BAKONG_ESCROW' || orderPaymentMethod === 'ABA_KHQR'" class="payment-qr-box">
        <div v-if="orderPaymentMethod === 'BAKONG_ESCROW'" class="escrow-status-header">
          <span class="escrow-badge"><ShieldCheck :size="14" /> {{ t('checkout.escrowBadge') }}</span>
          <p class="escrow-desc">
            <template v-if="paymentStatus === 'PAID'">
              <Lock :size="13" /> Funds verified and locked in Smart Contract escrow vault.
            </template>
            <template v-else>
              Scan below using Bakong or any Cambodian bank app. Funds will be held securely in Smart Contract until you confirm delivery.
            </template>
          </p>
        </div>
        <p>{{ t('checkout.payNow') }}</p>
        <img v-if="paymentQrImage" :src="paymentQrImage" :alt="t('checkout.qrAlt')" class="payment-qr-image" />
        <div v-else class="qr-generation-error" role="alert">
          <p>{{ paymentError || t('checkout.qrCreateFailed') }}</p>
          <button class="button button-outline" type="button" :disabled="retryingQr" @click="retryKhqr">{{ retryingQr ? t('checkout.qrRetrying') : t('checkout.qrRetry') }}</button>
        </div>
        <p>{{ t('checkout.totalDue') }}: <strong>{{ money(paymentTotal) }}</strong></p>
        <small>{{ t('checkout.qrHint', { orderNumber, amount: money(paymentTotal) }) }}</small>
        <span class="payment-status-badge" :class="paymentStatus.toLowerCase()">
          <i></i>{{ paymentStatus === 'PAID' ? (orderPaymentMethod === 'BAKONG_ESCROW' ? 'Escrow Funds Locked in Smart Contract' : t('checkout.paymentVerified')) : t('checkout.paymentPending') }}
        </span>
        <div v-if="orderPaymentMethod === 'BAKONG_ESCROW'" class="escrow-action-row">
          <RouterLink :to="'/escrow/' + encodeURIComponent(orderNumber)" class="button button-dark escrow-link-btn">
            <ShieldCheck :size="15" /> {{ t('escrow.viewContract') }}
          </RouterLink>
        </div>
      </div>
      <p v-else>{{ t('checkout.codHint') }}</p>
      <div class="success-actions">
        <RouterLink v-if="orderPaymentMethod === 'BAKONG_ESCROW'" :to="'/escrow/' + encodeURIComponent(orderNumber)" class="button button-outline">
          <ExternalLink :size="14" /> Open Escrow Vault Tracker
        </RouterLink>
        <RouterLink to="/shop" class="button button-dark">{{ t('cart.keepShopping') }}</RouterLink>
      </div>
    </div>
    <div v-else-if="!cart.lines.length" class="empty-state"><p>{{ t('cart.empty') }}</p><RouterLink to="/shop" class="button button-dark">{{ t('cart.emptyAction') }}</RouterLink></div>
    <div v-else class="checkout-layout">
      <!-- STEP 1: AUTHENTICATION (When guest has not signed in) -->
      <section v-if="!auth.user" class="checkout-auth-step" role="region" aria-label="Customer Login and Register">
        <div class="checkout-step-badge">
          <Lock :size="13" />
          <span>{{ t('checkout.checkoutStep1') }}</span>
        </div>
        <h1>{{ t('checkout.authRequiredTitle') }}</h1>
        <p class="checkout-auth-intro">{{ t('checkout.authRequiredDesc') }}</p>

        <!-- Instant 1-Click Demo Customer Login -->
        <button
          type="button"
          class="quick-demo-btn"
          :disabled="authBusy"
          @click="handleQuickDemoCustomer"
        >
          <Sparkles :size="15" />
          <span>{{ t('checkout.quickDemoCustomer') }}</span>
        </button>

        <div class="gate-divider">
          <span>{{ authMode === 'login' ? 'or sign in with email' : 'or create a new account' }}</span>
        </div>

        <div class="gate-tabs">
          <button
            type="button"
            class="gate-tab"
            :class="{ active: authMode === 'login' }"
            @click="authMode = 'login'"
          >
            <LogIn :size="13" /> {{ t('checkout.loginTab') }}
          </button>
          <button
            type="button"
            class="gate-tab"
            :class="{ active: authMode === 'register' }"
            @click="authMode = 'register'"
          >
            <UserPlus :size="13" /> {{ t('checkout.registerTab') }}
          </button>
        </div>

        <!-- In-Page Login Form -->
        <form v-if="authMode === 'login'" class="step-form" @submit.prevent="handleCheckoutLogin">
          <label class="form-field">
            <span>{{ t('checkout.email') }} *</span>
            <input v-model.trim="authForm.email" type="email" placeholder="customer@example.com" autocomplete="email" required />
          </label>
          <label class="form-field">
            <span>{{ t('account.password') }} *</span>
            <div class="password-input-shell">
              <input v-model="authForm.password" :type="revealAuthPassword ? 'text' : 'password'" placeholder="••••••••••••" autocomplete="current-password" required />
              <button type="button" class="eye-toggle" :aria-label="revealAuthPassword ? 'Hide password' : 'Show password'" @click="revealAuthPassword = !revealAuthPassword">
                <EyeOff v-if="revealAuthPassword" :size="16" />
                <Eye v-else :size="16" />
              </button>
            </div>
          </label>
          <p v-if="authError" class="form-error" role="alert">{{ authError }}</p>
          <button
            type="submit"
            class="button button-dark gate-submit-btn"
            :disabled="authBusy || !authForm.email || !authForm.password"
          >
            {{ authBusy ? t('common.loading') : t('checkout.proceedToDelivery') }} <ArrowRight :size="15" />
          </button>
          <p class="auth-switch-note">
            {{ t('checkout.newToMarket') }}
            <button type="button" @click="authMode = 'register'">{{ t('checkout.registerTab') }}</button>
          </p>
        </form>

        <!-- In-Page Register Form -->
        <form v-else class="step-form" @submit.prevent="handleCheckoutRegister">
          <div class="gate-fields-grid">
            <label class="form-field">
              <span>{{ t('account.name') }} *</span>
              <input v-model.trim="authForm.name" placeholder="Sophea Customer" autocomplete="name" required minlength="2" />
            </label>
            <label class="form-field">
              <span>{{ t('checkout.email') }} *</span>
              <input v-model.trim="authForm.email" type="email" placeholder="you@domain.com" autocomplete="email" required />
            </label>
            <label class="form-field">
              <span>{{ t('checkout.phone') }} *</span>
              <input v-model.trim="authForm.phone" type="tel" placeholder="012 345 678" autocomplete="tel" required />
            </label>
            <label class="form-field">
              <span>{{ t('account.password') }} *</span>
              <div class="password-input-shell">
                <input v-model="authForm.password" :type="revealAuthPassword ? 'text' : 'password'" placeholder="Min 10 characters" autocomplete="new-password" minlength="10" required />
                <button type="button" class="eye-toggle" :aria-label="revealAuthPassword ? 'Hide password' : 'Show password'" @click="revealAuthPassword = !revealAuthPassword">
                  <EyeOff v-if="revealAuthPassword" :size="16" />
                  <Eye v-else :size="16" />
                </button>
              </div>
            </label>
          </div>
          <p v-if="authError" class="form-error" role="alert">{{ authError }}</p>
          <button
            type="submit"
            class="button button-dark gate-submit-btn"
            :disabled="authBusy || !authForm.name || !authForm.email || !authForm.phone || authForm.password.length < 10"
          >
            {{ authBusy ? t('common.loading') : t('checkout.createAndProceed') }} <ArrowRight :size="15" />
          </button>
          <p class="auth-switch-note">
            {{ t('checkout.alreadyHaveAccount') }}
            <button type="button" @click="authMode = 'login'">{{ t('checkout.loginTab') }}</button>
          </p>
        </form>
      </section>

      <!-- STEP 2: DELIVERY & PAYMENT (When customer is authenticated) -->
      <form v-else class="checkout-form" @submit.prevent="placeOrder">
        <div class="checkout-step-badge is-active">
          <ShieldCheck :size="13" />
          <span>{{ t('checkout.checkoutStep2') }}</span>
        </div>
        <span class="section-kicker">{{ t('checkout.eyebrow') }}</span>
        <h1>{{ t('checkout.title') }}</h1>

        <!-- Verified Authenticated User Banner -->
        <div class="checkout-user-banner">
          <div class="banner-user-info">
            <span class="banner-icon"><UserCheck :size="18" /></span>
            <div>
              <span class="banner-status-tag">{{ t('checkout.loggedInAs') }}</span>
              <strong class="banner-user-name">{{ auth.user.name }}</strong>
              <small class="banner-user-meta">{{ auth.user.email }} · {{ auth.user.phone || 'Phone set on delivery' }}</small>
            </div>
          </div>
          <button type="button" class="banner-switch-btn" @click="handleLogout">
            {{ t('checkout.switchAccount') }}
          </button>
        </div>

        <h2>{{ t('checkout.details') }}</h2>
        <div class="form-grid">
          <label class="form-field span-two"><span>{{ t('checkout.name') }} *</span><input v-model.trim="form.customerName" autocomplete="name" required maxlength="100" /></label>
          <label class="form-field"><span>{{ t('checkout.email') }}</span><input v-model.trim="form.customerEmail" type="email" autocomplete="email" /></label>
          <label class="form-field"><span>{{ t('checkout.phone') }} *</span><input v-model.trim="form.customerPhone" type="tel" autocomplete="tel" required minlength="6" maxlength="30" /></label>
          <label class="form-field span-two"><span>{{ t('checkout.address') }} *</span><input v-model.trim="form.addressLine" autocomplete="street-address" required maxlength="240" /></label>
          <label class="form-field"><span>{{ t('checkout.city') }} *</span><input v-model.trim="form.city" required /></label>
          <label class="form-field"><span>{{ t('checkout.province') }} *</span><input v-model.trim="form.province" required /></label>
          <label class="form-field span-two"><span>{{ t('checkout.notes') }}</span><textarea v-model.trim="form.notes" rows="3" maxlength="500"></textarea></label>
        </div>

        <fieldset class="payment-choice">
          <legend>{{ t('checkout.payment') }}</legend>
          <label class="escrow-choice" :class="{ active: paymentMethod === 'BAKONG_ESCROW' }">
            <input v-model="paymentMethod" type="radio" name="payment" value="BAKONG_ESCROW" />
            <span>
              <span class="escrow-choice-badge"><ShieldCheck :size="13" /> {{ t('checkout.escrowBadge') }}</span>
              <strong>{{ t('checkout.escrow') }}</strong>
              <small>{{ t('checkout.escrowHint') }}</small>
            </span>
          </label>
          <label><input v-model="paymentMethod" type="radio" name="payment" value="ABA_KHQR" /><span><strong>{{ t('checkout.aba') }}</strong><small>{{ t('checkout.abaHint') }}</small></span></label>
          <label><input v-model="paymentMethod" type="radio" name="payment" value="CASH_ON_DELIVERY" /><span><strong>{{ t('checkout.cod') }}</strong><small>{{ t('checkout.codHint') }}</small></span></label>
        </fieldset>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>

        <button class="button button-dark checkout-submit" type="submit" :disabled="busy">
          {{ busy ? t('checkout.placing') : t('checkout.place') }}
        </button>
      </form>

      <!-- Cart summary side -->
      <aside class="order-summary checkout-summary">
        <h2>{{ t('cart.title') }}</h2>
        <div v-for="line in cart.lines" :key="line.product.id" class="checkout-item">
          <img :src="line.product.images[0]" :alt="productName(line.product, locale)" />
          <div>
            <strong>{{ productName(line.product, locale) }}</strong>
            <span>{{ line.quantity }} × {{ money(line.product.price) }}</span>
          </div>
          <b>{{ money(line.product.price * line.quantity) }}</b>
        </div>
        <div class="summary-row"><span>{{ t('cart.subtotal') }}</span><span>{{ money(cart.subtotal) }}</span></div>
        <div class="summary-row"><span>{{ t('cart.delivery') }}</span><span>{{ delivery ? money(delivery) : t('cart.free') }}</span></div>
        <div class="summary-total"><span>{{ t('cart.total') }}</span><strong>{{ money(total) }}</strong></div>
        <div v-if="!auth.user" class="summary-step-note">
          <Lock :size="12" />
          <span>{{ locale === 'km' ? 'សូមបំពេញជំហានទី ១ ដើម្បីបន្តទៅការដឹកជញ្ជូន' : 'Complete step 1 to proceed with delivery and payment' }}</span>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
.checkout-auth-step {
  padding: 32px 34px;
  border: 1px solid #d9d5c7;
  border-radius: 8px;
  background: #fdfcf7;
  box-shadow: 0 4px 18px rgba(38, 53, 47, 0.04);
}
.checkout-auth-step h1 {
  margin: 10px 0 6px;
  font-family: Georgia, 'Noto Sans Khmer', serif;
  font-size: 26px;
  font-weight: 400;
  color: var(--ink);
}
.checkout-auth-intro {
  margin: 0 0 20px;
  color: #60675f;
  font-size: 13px;
  line-height: 1.6;
}
.checkout-step-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  background: #ede9dc;
  color: #555c53;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 8px;
}
.checkout-step-badge.is-active {
  background: #e5eee7;
  color: #216742;
}
.step-form {
  display: flex;
  flex-direction: column;
  gap: 13px;
}
.password-input-shell {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
}
.password-input-shell input {
  width: 100%;
  padding-right: 38px;
}
.eye-toggle {
  position: absolute;
  right: 10px;
  top: 50%;
  transform: translateY(-50%);
  background: transparent;
  border: none;
  color: #79827a;
  cursor: pointer;
  padding: 4px;
  display: grid;
  place-items: center;
  transition: color 0.15s ease;
}
.eye-toggle:hover {
  color: var(--ink);
}
.auth-switch-note {
  margin: 10px 0 0;
  font-size: 12px;
  color: #666e66;
  text-align: center;
}
.auth-switch-note button {
  background: none;
  border: none;
  color: var(--moss);
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  margin-left: 4px;
  font-size: 12px;
}
.summary-step-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px 12px;
  background: #f4ede1;
  border: 1px dashed #d8cca8;
  border-radius: 6px;
  color: #745f28;
  font-size: 11px;
  line-height: 1.4;
}
.quick-demo-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 11px 16px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: linear-gradient(135deg, #26352f 0%, #3a5043 100%);
  color: #fffefa;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 4px 14px rgba(38, 53, 47, 0.12);
}
.quick-demo-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  background: linear-gradient(135deg, #1b2621 0%, #2f4337 100%);
  box-shadow: 0 6px 18px rgba(38, 53, 47, 0.2);
}
.quick-demo-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.gate-divider {
  display: flex;
  align-items: center;
  margin: 16px 0 14px;
  color: #8c9287;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.gate-divider::before,
.gate-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e2dfd5;
}
.gate-divider span {
  padding: 0 10px;
}
.gate-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
}
.gate-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  justify-content: center;
  padding: 8px 12px;
  border: 1px solid #d5d1c3;
  border-radius: 4px;
  background: #f7f5ed;
  color: #555c54;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}
.gate-tab.active {
  border-color: var(--moss);
  background: #fff;
  color: var(--ink);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
}
.gate-form-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.gate-fields-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 640px) {
  .gate-fields-grid {
    grid-template-columns: 1fr;
  }
}
.gate-submit-btn {
  width: 100%;
  margin-top: 4px;
  min-height: 42px;
}
.checkout-user-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
  padding: 14px 18px;
  border: 1px solid rgba(85, 112, 91, 0.35);
  border-radius: 8px;
  background: rgba(85, 112, 91, 0.08);
}
.banner-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}
.banner-icon {
  display: grid;
  width: 34px;
  height: 34px;
  place-items: center;
  border-radius: 50%;
  background: var(--moss);
  color: #fff;
  flex-shrink: 0;
}
.banner-status-tag {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--moss);
  font-weight: 700;
}
.banner-user-name {
  display: block;
  font-size: 14px;
  color: var(--ink);
}
.banner-user-meta {
  display: block;
  font-size: 11px;
  color: #60675f;
}
.banner-switch-btn {
  border: 1px solid #bfc2b6;
  border-radius: 4px;
  background: #fff;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 600;
  color: #555c54;
  cursor: pointer;
  transition: all 0.15s ease;
}
.banner-switch-btn:hover {
  border-color: var(--clay);
  color: var(--clay);
}
.fields-gated {
  opacity: 0.6;
  pointer-events: none;
  filter: grayscale(0.2);
}
.checkout-submit.is-locked {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: #777c72 !important;
  color: #fff !important;
  cursor: not-allowed !important;
  opacity: 0.8 !important;
}
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

.escrow-choice {
  border: 1px solid rgba(46, 125, 82, 0.4) !important;
  background: rgba(46, 125, 82, 0.04);
  position: relative;
  transition: all 0.2s ease;
}
.escrow-choice.active {
  border-color: #2e7d52 !important;
  background: rgba(46, 125, 82, 0.08);
  box-shadow: 0 0 0 1px #2e7d52;
}
.escrow-choice-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #2e7d52;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 2px 7px;
  border-radius: 4px;
  margin-bottom: 4px;
}
.escrow-status-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  margin-bottom: 0.5rem;
}
.escrow-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #e8f5ed;
  color: #216742;
  border: 1px solid #b7e0c8;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 999px;
}
.escrow-desc {
  font-size: 12px;
  color: #3b5244;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.escrow-action-row {
  margin-top: 0.75rem;
  width: 100%;
}
.escrow-link-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
}
.success-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 1rem;
}
</style>