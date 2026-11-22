<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { api, apiErrorMessage } from '../services/api';

type AdminAccount = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  createdAt: string;
};

const { locale } = useI18n();
const accounts = ref<AdminAccount[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const successMessage = ref('');
const form = reactive({ name: '', email: '', password: '' });

const isKhmer = () => locale.value === 'km';

onMounted(loadAccounts);

async function loadAccounts() {
  loading.value = true;
  error.value = '';
  try {
    const response = await api.get('/admin/accounts');
    accounts.value = response.data.data;
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  } finally {
    loading.value = false;
  }
}

async function createAccount() {
  saving.value = true;
  error.value = '';
  successMessage.value = '';
  try {
    await api.post('/admin/accounts', form);
    form.name = '';
    form.email = '';
    form.password = '';
    successMessage.value = isKhmer() ? 'បានបង្កើតគណនី Admin ដោយជោគជ័យ។' : 'Admin account created successfully.';
    await loadAccounts();
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="admin-accounts">
    <header class="accounts-heading">
      <div>
        <p>{{ isKhmer() ? 'សិទ្ធិ Super Admin' : 'SUPER ADMIN ACCESS' }}</p>
        <h2>{{ isKhmer() ? 'គណនី Admin' : 'Administrator accounts' }}</h2>
        <span>{{ isKhmer() ? 'បង្កើតគណនី Admin ថ្មី។ ពាក្យសម្ងាត់ត្រូវបានអ៊ិនគ្រីបមុនពេលរក្សាទុក។' : 'Create staff accounts. Passwords are hashed before they are stored.' }}</span>
      </div>
    </header>

    <form class="account-form" @submit.prevent="createAccount">
      <label>
        <span>{{ isKhmer() ? 'ឈ្មោះ' : 'Name' }}</span>
        <input v-model.trim="form.name" type="text" autocomplete="name" minlength="2" maxlength="100" required />
      </label>
      <label>
        <span>{{ isKhmer() ? 'អ៊ីមែល' : 'Email' }}</span>
        <input v-model.trim="form.email" type="email" autocomplete="email" maxlength="254" required />
      </label>
      <label>
        <span>{{ isKhmer() ? 'ពាក្យសម្ងាត់ (យ៉ាងតិច ១០ តួ)' : 'Password (at least 10 characters)' }}</span>
        <input v-model="form.password" type="password" autocomplete="new-password" minlength="10" maxlength="128" required />
      </label>
      <button type="submit" :disabled="saving">{{ saving ? (isKhmer() ? 'កំពុងរក្សាទុក...' : 'Creating...') : (isKhmer() ? 'បង្កើត Admin' : 'Create admin') }}</button>
    </form>

    <p v-if="error" class="accounts-message accounts-error" role="alert">{{ error }}</p>
    <p v-if="successMessage" class="accounts-message accounts-success" role="status">{{ successMessage }}</p>

    <div class="accounts-list">
      <h3>{{ isKhmer() ? 'អ្នកគ្រប់គ្រងបច្ចុប្បន្ន' : 'Current administrators' }}</h3>
      <p v-if="loading">{{ isKhmer() ? 'កំពុងផ្ទុក...' : 'Loading...' }}</p>
      <p v-else-if="accounts.length === 0">{{ isKhmer() ? 'មិនទាន់មានគណនី Admin ទេ។' : 'No administrator accounts yet.' }}</p>
      <ul v-else>
        <li v-for="account in accounts" :key="account.id">
          <span><strong>{{ account.name }}</strong><small>{{ account.email }}</small></span>
          <span class="account-role">{{ account.role === 'SUPER_ADMIN' ? 'SUPER ADMIN' : 'ADMIN' }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.admin-accounts { display: grid; gap: 18px; padding: 22px; color: #e8eee8; background: #17211c; border: 1px solid #35443b; }
.accounts-heading p { margin: 0 0 6px; color: #a4c19e; font-size: 9px; font-weight: 700; letter-spacing: 1px; }
.accounts-heading h2 { margin: 0 0 7px; font-size: 19px; }
.accounts-heading span { color: #a2afa5; font-size: 11px; }
.account-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; gap: 12px; }
.account-form label { display: grid; gap: 6px; color: #d1dad2; font-size: 10px; }
.account-form input { min-width: 0; height: 38px; border: 1px solid #46564b; border-radius: 3px; padding: 0 10px; color: #f2f5ef; background: #111815; }
.account-form button { min-height: 38px; grid-column: 1 / -1; border: 0; border-radius: 3px; color: #1c2119; background: #e5c76a; cursor: pointer; font-weight: 700; }
.account-form button:disabled { cursor: wait; opacity: .6; }
.accounts-message { margin: 0; font-size: 11px; }
.accounts-error { color: #ff9c8e; }
.accounts-success { color: #9bd3a4; }
.accounts-list { border-top: 1px solid #35443b; padding-top: 12px; }
.accounts-list h3 { margin: 0 0 9px; font-size: 13px; }
.accounts-list > p { color: #a2afa5; font-size: 11px; }
.accounts-list ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.accounts-list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid #35443b; padding: 10px 12px; }
.accounts-list li > span:first-child { display: grid; gap: 4px; }
.accounts-list strong { font-size: 11px; }
.accounts-list small { color: #a2afa5; font-size: 10px; }
.account-role { color: #e5c76a; font-size: 8px; font-weight: 700; letter-spacing: .5px; }
@media (max-width: 760px) { .account-form { grid-template-columns: 1fr; }.account-form button { grid-column: auto; } }
</style>
