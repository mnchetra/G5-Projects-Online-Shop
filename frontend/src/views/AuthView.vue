<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { 
  ShieldCheck, 
  Truck, 
  Sparkles, 
  Lock, 
  Mail, 
  User, 
  Phone, 
  Eye, 
  EyeOff, 
  ArrowRight, 
  ArrowLeft,
  CheckCircle2,
  Leaf
} from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { apiErrorMessage } from '../services/api';

const { t, locale } = useI18n();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

// Tab state: 'login' | 'register'
const activeTab = ref<'login' | 'register'>(route.path === '/register' || route.query.mode === 'register' ? 'register' : 'login');
const loading = ref(false);
const error = ref('');
const success = ref('');
const showPassword = ref(false);

const form = reactive({
  name: '',
  email: '',
  phone: '',
  password: ''
});

// Update activeTab when route changes
watch(() => route.path, (path) => {
  if (path === '/register') activeTab.value = 'register';
  else if (path === '/login') activeTab.value = 'login';
});

// Redirect if already logged in
onMounted(async () => {
  if (!auth.checked) await auth.fetchMe();
  if (auth.user) {
    const destination = getDestination();
    await router.replace(destination);
  }
});

function getDestination(): string {
  const redirect = route.query.redirect;
  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('/login') && !redirect.startsWith('/register')) {
    return redirect;
  }
  return '/account';
}

function switchTab(tab: 'login' | 'register') {
  activeTab.value = tab;
  error.value = '';
  success.value = '';
  // Update browser URL smoothly without reloading
  if (tab === 'register' && route.path !== '/register') {
    void router.replace({ path: '/register', query: route.query });
  } else if (tab === 'login' && route.path !== '/login') {
    void router.replace({ path: '/login', query: route.query });
  }
}

async function fillAndLoginDemo() {
  loading.value = true;
  error.value = '';
  success.value = '';
  form.email = 'customer@example.com';
  form.password = 'Customer12345!';
  try {
    await auth.login('customer@example.com', 'Customer12345!');
    success.value = locale.value === 'km' ? 'បានចូលគណនីជោគជ័យ' : 'Signed in successfully!';
    await router.replace(getDestination());
  } catch (exception) {
    error.value = apiErrorMessage(exception) || t('account.failed');
  } finally {
    loading.value = false;
  }
}

async function handleSubmit() {
  loading.value = true;
  error.value = '';
  success.value = '';
  try {
    if (activeTab.value === 'register') {
      if (!form.name || form.name.length < 2) {
        error.value = locale.value === 'km' ? 'សូមបញ្ចូលឈ្មោះយ៉ាងតិច ២ តួអក្សរ' : 'Please enter a name with at least 2 characters.';
        loading.value = false;
        return;
      }
      if (!form.password || form.password.length < 10) {
        error.value = locale.value === 'km' ? 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងតិច ១០ តួអក្សរ' : 'Password must be at least 10 characters long.';
        loading.value = false;
        return;
      }
      await auth.register({
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password
      });
      success.value = locale.value === 'km' ? 'គណនីត្រូវបានបង្កើតជោគជ័យ' : 'Account created successfully!';
    } else {
      await auth.login(form.email.trim(), form.password);
      success.value = locale.value === 'km' ? 'បានចូលគណនីជោគជ័យ' : 'Signed in successfully!';
    }
    await router.replace(getDestination());
  } catch (exception) {
    error.value = apiErrorMessage(exception) || t('account.failed');
  } finally {
    loading.value = false;
  }
}

const isRegisterValid = computed(() => {
  return form.name.length >= 2 && form.email.includes('@') && form.password.length >= 10;
});
const isLoginValid = computed(() => {
  return form.email.includes('@') && form.password.length >= 1;
});
</script>

<template>
  <main class="auth-page">
    <div class="auth-container">
      <RouterLink to="/" class="auth-back-link">
        <ArrowLeft :size="16" />
        <span>{{ t('common.backHome') }}</span>
      </RouterLink>

      <div class="auth-shell">
        <!-- Left Side: Brand Showcase & Member Benefits -->
        <section class="auth-hero-panel">
          <div class="hero-top">
            <RouterLink to="/" class="auth-brand">
              <span class="auth-brand-mark"><Leaf :size="20" /></span>
              <span class="auth-brand-name">{{ t('brand') }}</span>
            </RouterLink>
            <span class="auth-badge">{{ t('auth.badge') }}</span>
          </div>

          <div class="hero-middle">
            <h1 class="hero-title">{{ t('home.title') }}</h1>
            <p class="hero-description">{{ t('home.description') }}</p>

            <ul class="benefits-list" aria-label="Member benefits">
              <li class="benefit-item">
                <span class="benefit-icon"><ShieldCheck :size="18" /></span>
                <div>
                  <strong>{{ t('auth.perk1Title') }}</strong>
                  <p>{{ t('auth.perk1Desc') }}</p>
                </div>
              </li>
              <li class="benefit-item">
                <span class="benefit-icon"><Truck :size="18" /></span>
                <div>
                  <strong>{{ t('auth.perk2Title') }}</strong>
                  <p>{{ t('auth.perk2Desc') }}</p>
                </div>
              </li>
              <li class="benefit-item">
                <span class="benefit-icon"><Sparkles :size="18" /></span>
                <div>
                  <strong>{{ t('auth.perk3Title') }}</strong>
                  <p>{{ t('auth.perk3Desc') }}</p>
                </div>
              </li>
            </ul>
          </div>

          <div class="hero-quote-card">
            <div class="quote-content">
              <p class="quote-text">“{{ t('auth.quote') }}”</p>
              <span class="quote-signoff">Mekong Market · Cambodia</span>
            </div>
          </div>
        </section>

        <!-- Right Side: Interactive Login / Register Form -->
        <section class="auth-form-panel">
          <!-- Segmented Tab Switcher -->
          <div class="auth-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'login'"
              class="auth-tab"
              :class="{ active: activeTab === 'login' }"
              @click="switchTab('login')"
            >
              {{ t('auth.signInTab') }}
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'register'"
              class="auth-tab"
              :class="{ active: activeTab === 'register' }"
              @click="switchTab('register')"
            >
              {{ t('auth.registerTab') }}
            </button>
          </div>

          <!-- Form Header -->
          <div class="form-header">
            <span class="form-eyebrow">{{ activeTab === 'login' ? 'WELCOME BACK' : 'NEW CUSTOMER' }}</span>
            <h2>{{ activeTab === 'login' ? t('auth.welcomeBack') : t('auth.createAccount') }}</h2>
            <p>{{ activeTab === 'login' ? t('auth.welcomeSubtitle') : t('auth.createSubtitle') }}</p>
          </div>

          <!-- 1-Click Instant Demo Login -->
          <button
            type="button"
            class="demo-login-card"
            :disabled="loading"
            @click="fillAndLoginDemo"
          >
            <div class="demo-card-left">
              <span class="demo-sparkle"><Sparkles :size="15" /></span>
              <div class="demo-card-text">
                <strong>{{ t('auth.demoCustomerBtn') }}</strong>
                <small>customer@example.com · Instant access</small>
              </div>
            </div>
            <ArrowRight :size="16" class="demo-arrow" />
          </button>

          <div class="auth-divider">
            <span>{{ activeTab === 'login' ? 'or sign in with email' : 'or register with email' }}</span>
          </div>

          <!-- Interactive Form -->
          <form class="auth-form" @submit.prevent="handleSubmit">
            <!-- Full Name (Register only) -->
            <label v-if="activeTab === 'register'" class="input-group">
              <span class="input-label">{{ t('auth.nameLabel') }} *</span>
              <div class="input-shell">
                <User :size="16" class="input-icon" />
                <input
                  v-model.trim="form.name"
                  type="text"
                  autocomplete="name"
                  required
                  minlength="2"
                  maxlength="80"
                  placeholder="Sophea Meas"
                />
              </div>
            </label>

            <!-- Email Address -->
            <label class="input-group">
              <span class="input-label">{{ t('auth.emailLabel') }} *</span>
              <div class="input-shell">
                <Mail :size="16" class="input-icon" />
                <input
                  v-model.trim="form.email"
                  type="email"
                  autocomplete="email"
                  required
                  placeholder="name@example.com"
                />
              </div>
            </label>

            <!-- Phone Number (Register only) -->
            <label v-if="activeTab === 'register'" class="input-group">
              <span class="input-label">{{ t('auth.phoneLabel') }}</span>
              <div class="input-shell">
                <Phone :size="16" class="input-icon" />
                <input
                  v-model.trim="form.phone"
                  type="tel"
                  autocomplete="tel"
                  placeholder="012 345 678"
                />
              </div>
              <small class="field-hint">{{ t('auth.phoneHint') }}</small>
            </label>

            <!-- Password with Show/Hide toggle -->
            <label class="input-group">
              <span class="input-label">{{ t('auth.passwordLabel') }} *</span>
              <div class="input-shell">
                <Lock :size="16" class="input-icon" />
                <input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  :autocomplete="activeTab === 'register' ? 'new-password' : 'current-password'"
                  :minlength="activeTab === 'register' ? 10 : 1"
                  required
                  :placeholder="activeTab === 'register' ? '••••••••••••' : '••••••••••••'"
                />
                <button
                  type="button"
                  class="password-toggle-btn"
                  :aria-label="showPassword ? t('auth.hidePassword') : t('auth.showPassword')"
                  @click="showPassword = !showPassword"
                >
                  <EyeOff v-if="showPassword" :size="16" />
                  <Eye v-else :size="16" />
                </button>
              </div>
              <small v-if="activeTab === 'register'" class="field-hint">
                {{ t('account.passwordHint') }}
              </small>
            </label>

            <!-- Error and Success Messages -->
            <div v-if="error" class="auth-alert error-alert" role="alert">
              <span>{{ error }}</span>
            </div>
            <div v-if="success" class="auth-alert success-alert" role="status">
              <CheckCircle2 :size="15" />
              <span>{{ success }}</span>
            </div>

            <!-- Submit Button -->
            <button
              type="submit"
              class="auth-submit-btn"
              :disabled="loading || (activeTab === 'register' ? !isRegisterValid : !isLoginValid)"
            >
              <span>{{ loading ? t('common.loading') : activeTab === 'register' ? t('account.register') : t('account.login') }}</span>
              <ArrowRight v-if="!loading" :size="16" />
            </button>
          </form>

          <!-- Toggle Bottom Link -->
          <div class="auth-footer-toggle">
            <template v-if="activeTab === 'login'">
              <span>{{ t('auth.noAccountPrompt') }}</span>
              <button type="button" class="switch-link" @click="switchTab('register')">
                {{ t('account.register') }}
              </button>
            </template>
            <template v-else>
              <span>{{ t('auth.hasAccountPrompt') }}</span>
              <button type="button" class="switch-link" @click="switchTab('login')">
                {{ t('account.login') }}
              </button>
            </template>
          </div>

          <p class="auth-terms-note">
            {{ t('auth.agreeTerms') }}
          </p>
        </section>
      </div>
    </div>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: calc(100vh - 120px);
  padding: 40px 20px 80px;
  background: var(--paper, #f5f3ec);
  display: flex;
  justify-content: center;
  align-items: center;
}

.auth-container {
  width: min(1040px, 100%);
  margin: 0 auto;
}

.auth-back-link {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 20px;
  color: #55705b;
  font-size: 12px;
  font-weight: 600;
  transition: color 0.15s ease;
}

.auth-back-link:hover {
  color: #26352f;
}

.auth-shell {
  display: grid;
  grid-template-columns: 0.95fr 1.05fr;
  background: #ffffff;
  border: 1px solid #e2ded4;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(38, 53, 47, 0.07);
}

/* LEFT HERO PANEL */
.auth-hero-panel {
  background: linear-gradient(160deg, #18251e 0%, #23352b 55%, #2d4538 100%);
  color: #f5f3ec;
  padding: 48px 42px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  position: relative;
  overflow: hidden;
}

.auth-hero-panel::after {
  content: '';
  position: absolute;
  top: -50px;
  right: -50px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(229, 199, 106, 0.12) 0%, transparent 70%);
  pointer-events: none;
}

.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 36px;
}

.auth-brand {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  color: #ffffff;
  text-decoration: none;
}

.auth-brand-mark {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border-radius: 50%;
  background: #bd6846;
  color: #ffffff;
}

.auth-brand-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.01em;
}

.auth-badge {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  padding: 4px 9px;
  border-radius: 999px;
  background: rgba(229, 199, 106, 0.16);
  border: 1px solid rgba(229, 199, 106, 0.4);
  color: #e5c76a;
}

.hero-title {
  font-family: Georgia, 'Noto Sans Khmer', serif;
  font-size: clamp(26px, 2.5vw, 34px);
  font-weight: 400;
  line-height: 1.2;
  margin: 0 0 14px;
  color: #ffffff;
}

.hero-description {
  color: #b5c3b9;
  font-size: 13px;
  line-height: 1.6;
  margin: 0 0 32px;
}

.benefits-list {
  list-style: none;
  padding: 0;
  margin: 0 0 36px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.benefit-item {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.benefit-icon {
  display: grid;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  place-items: center;
  border-radius: 8px;
  background: rgba(85, 112, 91, 0.35);
  border: 1px solid rgba(85, 112, 91, 0.5);
  color: #e5c76a;
}

.benefit-item strong {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #ffffff;
  margin-bottom: 2px;
}

.benefit-item p {
  margin: 0;
  font-size: 11px;
  color: #a3b5a8;
  line-height: 1.5;
}

.hero-quote-card {
  margin-top: auto;
  padding: 16px 20px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.09);
}

.quote-text {
  margin: 0 0 6px;
  font-style: italic;
  font-size: 12px;
  line-height: 1.5;
  color: #e1e9e3;
}

.quote-signoff {
  font-size: 10px;
  color: #92a396;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

/* RIGHT FORM PANEL */
.auth-form-panel {
  padding: 44px 44px 38px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  background: #ffffff;
}

.auth-tabs {
  display: flex;
  padding: 4px;
  background: #f1eee4;
  border-radius: 8px;
  margin-bottom: 24px;
}

.auth-tab {
  flex: 1;
  padding: 9px 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #5d665e;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.auth-tab.active {
  background: #ffffff;
  color: #26352f;
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.06);
  font-weight: 700;
}

.form-header {
  margin-bottom: 20px;
}

.form-eyebrow {
  display: inline-block;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #55705b;
  margin-bottom: 4px;
}

.form-header h2 {
  font-family: Georgia, 'Noto Sans Khmer', serif;
  font-size: 24px;
  font-weight: 400;
  color: #26352f;
  margin: 0 0 6px;
}

.form-header p {
  color: #6a746c;
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}

/* Demo Login Card */
.demo-login-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 11px 16px;
  margin-bottom: 18px;
  border: 1px solid #d9d5c5;
  border-radius: 8px;
  background: #fdfaf3;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.demo-login-card:hover:not(:disabled) {
  border-color: #bd6846;
  background: #fff6ee;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(189, 104, 70, 0.12);
}

.demo-login-card:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.demo-card-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.demo-sparkle {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border-radius: 6px;
  background: #bd6846;
  color: #ffffff;
  flex-shrink: 0;
}

.demo-card-text strong {
  display: block;
  font-size: 12px;
  color: #26352f;
}

.demo-card-text small {
  display: block;
  font-size: 10px;
  color: #79827a;
}

.demo-arrow {
  color: #bd6846;
  transition: transform 0.15s ease;
}

.demo-login-card:hover .demo-arrow {
  transform: translateX(3px);
}

.auth-divider {
  display: flex;
  align-items: center;
  margin-bottom: 18px;
  color: #9aa29b;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.auth-divider::before,
.auth-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: #e8e5db;
}

.auth-divider span {
  padding: 0 10px;
}

/* FORM INPUTS */
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.input-label {
  font-size: 11px;
  font-weight: 600;
  color: #3e4840;
}

.input-shell {
  display: flex;
  align-items: center;
  border: 1px solid #d4d0c2;
  border-radius: 6px;
  background: #fffefa;
  padding: 0 12px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input-shell:focus-within {
  border-color: #55705b;
  box-shadow: 0 0 0 3px rgba(85, 112, 91, 0.12);
}

.input-icon {
  color: #7f8981;
  margin-right: 10px;
  flex-shrink: 0;
}

.input-shell input {
  width: 100%;
  height: 42px;
  border: 0;
  outline: none;
  background: transparent;
  font-size: 13px;
  color: #26352f;
}

.input-shell input::placeholder {
  color: #a4aca5;
  font-size: 12px;
}

.password-toggle-btn {
  border: 0;
  background: transparent;
  color: #7f8981;
  cursor: pointer;
  padding: 4px;
  display: grid;
  place-items: center;
  transition: color 0.15s ease;
}

.password-toggle-btn:hover {
  color: #26352f;
}

.field-hint {
  font-size: 10px;
  color: #7f8981;
  margin-top: 2px;
}

/* ALERTS */
.auth-alert {
  padding: 10px 14px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.5;
  display: flex;
  align-items: center;
  gap: 8px;
}

.error-alert {
  background: #fdf2f0;
  border: 1px solid #f5cfca;
  color: #b33927;
}

.success-alert {
  background: #eef6f0;
  border: 1px solid #c8e3ce;
  color: #256b37;
}

/* SUBMIT BUTTON */
.auth-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 46px;
  margin-top: 6px;
  border: 0;
  border-radius: 6px;
  background: #26352f;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.auth-submit-btn:hover:not(:disabled) {
  background: #55705b;
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(38, 53, 47, 0.16);
}

.auth-submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

/* TOGGLE BOTTOM */
.auth-footer-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 22px;
  font-size: 12px;
  color: #6a746c;
}

.switch-link {
  border: 0;
  background: transparent;
  color: #55705b;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.switch-link:hover {
  color: #bd6846;
}

.auth-terms-note {
  margin: 18px 0 0;
  font-size: 10px;
  color: #929a93;
  text-align: center;
  line-height: 1.5;
}

/* RESPONSIVE */
@media (max-width: 860px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }
  .auth-hero-panel {
    padding: 32px 24px;
    border-right: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
  .benefits-list {
    margin-bottom: 24px;
  }
  .auth-form-panel {
    padding: 32px 24px 28px;
  }
}
</style>
