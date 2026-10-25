<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { ShieldCheck, UserCheck } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { api, apiErrorMessage } from '../services/api';

type CustomerOrder = {
  orderNumber: string;
  status: string;
  createdAt: string;
  total: number;
  paymentMethod?: string;
  escrow?: { status: string } | null;
};
const { t, locale } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const registering = ref(false);
const loading = ref(false);
const error = ref('');
const success = ref('');
const orders = ref<CustomerOrder[]>([]);
const form = reactive({ name: '', email: '', phone: '', password: '' });

onMounted(async () => {
  if (!auth.checked) await auth.fetchMe();
  if (auth.user) {
    form.name = auth.user.name; form.email = auth.user.email; form.phone = auth.user.phone || '';
    await loadOrders();
  } else {
    await router.replace({ path: '/login', query: { redirect: '/account' } });
  }
});

function fillDemo(type: 'customer' | 'admin') {
  registering.value = false;
  if (type === 'customer') {
    form.email = 'customer@example.com';
    form.password = 'Customer12345!';
  } else {
    form.email = 'admin@example.com';
    form.password = 'Admin12345!';
  }
}

async function submit() {
  loading.value = true; error.value = ''; success.value = '';
  try {
    if (registering.value) await auth.register(form);
    else await auth.login(form.email, form.password);
    form.name = auth.user?.name || form.name;

    const redirect = route.query.redirect as string;
    if (redirect && redirect.startsWith('/')) {
      await router.push(redirect);
      return;
    }

    await loadOrders();
  } catch (exception) { error.value = apiErrorMessage(exception) || t('account.failed'); }
  finally { loading.value = false; }
}

async function loadOrders() {
  try { orders.value = (await api.get('/orders')).data.data; } catch { orders.value = []; }
}

async function saveProfile() {
  error.value = ''; success.value = '';
  try {
    const { data } = await api.patch('/users/profile', { name: form.name, phone: form.phone || undefined });
    auth.user = data.data.user;
    success.value = locale.value === 'km' ? 'បានរក្សាទុកហើយ' : 'Your details are up to date.';
  } catch (exception) { error.value = apiErrorMessage(exception); }
}

const date = (value: string) => new Intl.DateTimeFormat(locale.value === 'km' ? 'km-KH' : 'en-US', { dateStyle: 'medium' }).format(new Date(value));
const money = (value: number) => new Intl.NumberFormat(locale.value === 'km' ? 'km-KH' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
</script>

<template>
  <section class="account-page page-wrap">
    <div v-if="!auth.user" class="account-auth">
      <div class="account-intro">
        <span class="section-kicker">{{ t('nav.account') }}</span>
        <h1>{{ registering ? t('account.registerTitle') : t('account.title') }}</h1>
        <p>{{ t('account.intro') }}</p>
        <div class="demo-accounts-pill">
          <span class="demo-label">{{ t('account.demoAccounts') }}</span>
          <div class="demo-buttons">
            <button type="button" class="demo-btn" @click="fillDemo('customer')">
              <UserCheck :size="12" /> {{ t('account.fillCustomer') }}
            </button>
            <button type="button" class="demo-btn" @click="fillDemo('admin')">
              <ShieldCheck :size="12" /> {{ t('account.fillAdmin') }}
            </button>
          </div>
        </div>
      </div>
      <form class="auth-form" @submit.prevent="submit">
        <label v-if="registering" class="form-field"><span>{{ t('account.name') }}</span><input v-model.trim="form.name" autocomplete="name" required minlength="2" /></label>
        <label class="form-field"><span>{{ t('checkout.email') }}</span><input v-model.trim="form.email" type="email" autocomplete="email" required /></label>
        <label v-if="registering" class="form-field"><span>{{ t('checkout.phone') }}</span><input v-model.trim="form.phone" type="tel" autocomplete="tel" /></label>
        <label class="form-field"><span>{{ t('account.password') }}</span><input v-model="form.password" type="password" :autocomplete="registering ? 'new-password' : 'current-password'" :minlength="registering ? 10 : 1" required /><small v-if="registering">{{ t('account.passwordHint') }}</small></label>
        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button class="button button-dark auth-submit" type="submit" :disabled="loading">{{ loading ? t('common.loading') : registering ? t('account.register') : t('account.login') }}</button>
        <p class="auth-toggle">
          <template v-if="registering">{{ t('account.hasAccount') }} <button type="button" @click="registering = false">{{ t('account.login') }}</button></template>
          <template v-else>{{ t('account.noAccount') }} <button type="button" @click="registering = true">{{ t('account.register') }}</button></template>
        </p>
      </form>
    </div>
    <div v-else class="account-dashboard">
      <div class="account-title-row"><div><span class="section-kicker">YOUR MARKET ACCOUNT</span><h1>{{ t('account.title') }}</h1><p>{{ auth.user.name }} · {{ auth.user.email }}</p></div><button class="button button-outline" type="button" @click="auth.logout">{{ t('account.signOut') }}</button></div>
      <p v-if="$route.query.admin === 'required'" class="form-error">{{ t('admin.access') }}</p>
      <div class="account-content">
        <section class="profile-panel"><h2>{{ t('account.profile') }}</h2><form @submit.prevent="saveProfile"><label class="form-field"><span>{{ t('account.name') }}</span><input v-model.trim="form.name" required minlength="2" /></label><label class="form-field"><span>{{ t('checkout.phone') }}</span><input v-model.trim="form.phone" type="tel" /></label><button class="button button-dark" type="submit">{{ t('account.save') }}</button></form></section>
        <section class="orders-panel">
          <div class="section-heading compact-heading"><h2>{{ t('account.orders') }}</h2></div>
          <div v-if="orders.length" class="orders-table-wrap">
            <table class="orders-table">
              <thead><tr><th>{{ t('account.order') }}</th><th>{{ t('account.date') }}</th><th>{{ t('account.status') }}</th><th>Escrow Vault</th><th>{{ t('account.amount') }}</th></tr></thead>
              <tbody>
                <tr v-for="order in orders" :key="order.orderNumber">
                  <td>{{ order.orderNumber }}</td><td>{{ date(order.createdAt) }}</td><td><span class="status-tag" :class="`status-${order.status.toLowerCase()}`">{{ t(`status.${order.status}`) }}</span></td><td><RouterLink v-if="order.escrow || order.paymentMethod === 'BAKONG_ESCROW'" :to="'/escrow/' + order.orderNumber" class="escrow-cell-link"><ShieldCheck :size="13" /> {{ t(`status.${order.escrow?.status || 'INITIATED'}`) }}</RouterLink><span v-else class="text-muted">—</span></td><td>{{ money(Number(order.total)) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="muted-empty">{{ t('account.noOrders') }}</p>
        </section>
      </div>
      <p v-if="success" class="form-success">{{ success }}</p>
    </div>
  </section>
</template>

<style scoped>
.escrow-cell-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #eaf3ed;
  color: #216742;
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.2s;
}
.escrow-cell-link:hover {
  background: #216742;
  color: #fff;
}
.text-muted {
  color: #9baaa0;
  font-size: 12px;
}
.demo-accounts-pill {
  margin-top: 18px;
  padding: 12px 14px;
  background: #fbfaf5;
  border: 1px dashed #d5d1c3;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.demo-label {
  font-size: 11px;
  font-weight: 600;
  color: #596159;
}
.demo-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.demo-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #fff;
  border: 1px solid #c9c5b6;
  border-radius: 4px;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 600;
  color: #26352f;
  cursor: pointer;
  transition: all 0.15s ease;
}
.demo-btn:hover {
  background: #26352f;
  color: #fff;
  border-color: #26352f;
}
</style>