<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ArrowLeft, Eye, EyeOff, ShieldCheck } from 'lucide-vue-next';
import { useAuthStore } from '../stores/auth';
import { apiErrorMessage } from '../services/api';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const email = ref('');
const password = ref('');
const revealPassword = ref(false);
const loading = ref(false);
const error = ref('');

onMounted(async () => {
  if (!auth.checked) await auth.fetchMe();
  if (auth.user?.role === 'ADMIN') await router.replace('/admin');
});

async function submit() {
  loading.value = true;
  error.value = '';
  try {
    await auth.login(email.value.trim(), password.value);
    if (auth.user?.role !== 'ADMIN') {
      await auth.logout();
      error.value = 'This account does not have administrator access.';
      return;
    }
    const requestedPath = typeof route.query.redirect === 'string' ? route.query.redirect : '/admin';
    const destination = requestedPath.startsWith('/admin') && !requestedPath.startsWith('/admin/login') ? requestedPath : '/admin';
    await router.replace(destination);
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="admin-login-page">
    <a class="return-shop" href="/"><ArrowLeft :size="15" />Return to shop</a>
    <section class="admin-login-shell">
      <div class="login-brand-panel">
        <div class="login-brand-mark"><ShieldCheck :size="23" /></div>
        <span class="login-eyebrow">MEKONG MARKET · CONTROL ROOM</span>
        <h1>Administrator<br />sign in</h1>
        <p>Access is limited to authorized store administrators. Activity may be monitored.</p>
        <div class="login-security-note"><span></span>Protected admin session</div>
      </div>
      <form class="admin-login-form" @submit.prevent="submit">
        <div class="form-heading"><span class="login-eyebrow">SECURE ACCESS</span><h2>Welcome back</h2><p>Use your administrator account to continue.</p></div>
        <label><span>Email address</span><input v-model.trim="email" type="email" autocomplete="username" inputmode="email" required autofocus placeholder="admin@example.com" /></label>
        <label><span>Password</span><span class="password-field"><input v-model="password" :type="revealPassword ? 'text' : 'password'" autocomplete="current-password" required /><button type="button" :aria-label="revealPassword ? 'Hide password' : 'Show password'" @click="revealPassword = !revealPassword"><EyeOff v-if="revealPassword" :size="16" /><Eye v-else :size="16" /></button></span></label>
        <p v-if="error" class="login-error" role="alert">{{ error }}</p>
        <button class="login-submit" type="submit" :disabled="loading">{{ loading ? 'Verifying access…' : 'Sign in securely' }}<ShieldCheck :size="16" /></button>
        <div class="login-footnote"><ShieldCheck :size="14" /><span>Your password is verified by the server and never stored in this browser.</span></div>
        <p class="mfa-not-ready">Multi-factor authentication is not yet configured for this server.</p>
      </form>
    </section>
    <footer class="login-footer"><span>© 2026 Mekong Market</span><span>Administrator access only</span></footer>
  </main>
</template>

<style scoped>
.admin-login-page { position: relative; display: flex; min-height: 100vh; flex-direction: column; justify-content: center; padding: 72px 28px 48px; color: #f2f5ef; background: #111815; font-family: Inter, 'Noto Sans Khmer', sans-serif; }
.admin-login-page:lang(km) { font-family: 'Noto Sans Khmer', Inter, sans-serif; }
.return-shop { position: absolute; top: 25px; left: max(28px, calc((100% - 960px) / 2)); display: inline-flex; align-items: center; gap: 7px; color: #a2afa5; font-size: 11px; }.return-shop:hover { color: #f2f5ef; }
.admin-login-shell { display: grid; width: min(860px, 100%); min-height: 480px; grid-template-columns: .88fr 1.12fr; margin: 0 auto; border: 1px solid #35443b; background: #17211c; box-shadow: 0 25px 80px #0003; }
.login-brand-panel { display: flex; flex-direction: column; align-items: flex-start; justify-content: center; padding: 48px; border-right: 1px solid #35443b; background: #1a2820; }
.login-brand-mark { display: grid; width: 46px; height: 46px; place-items: center; margin-bottom: 35px; border: 1px solid #526e58; color: #e5c76a; background: #26382b; }
.login-eyebrow { color: #a4c19e; font-size: 9px; font-weight: 700; letter-spacing: 1.1px; }
.login-brand-panel h1 { margin: 14px 0 13px; font-family: Georgia, 'Noto Sans Khmer', serif; font-size: 35px; font-weight: 400; line-height: 1.17; }
.login-brand-panel > p { max-width: 275px; margin: 0; color: #a2afa5; font-size: 11px; line-height: 1.8; }
.login-security-note { display: flex; align-items: center; gap: 8px; margin-top: 49px; color: #b5c6b7; font-size: 9px; }.login-security-note span { width: 7px; height: 7px; border-radius: 50%; background: #8bc89c; }
.admin-login-form { display: flex; flex-direction: column; justify-content: center; padding: 48px clamp(28px, 5vw, 61px); }
.form-heading { margin-bottom: 27px; }.form-heading h2 { margin: 7px 0 5px; font-size: 22px; font-weight: 600; }.form-heading p { margin: 0; color: #a2afa5; font-size: 10px; }
.admin-login-form > label { display: flex; flex-direction: column; gap: 7px; margin-bottom: 16px; color: #d1dad2; font-size: 10px; font-weight: 600; }
.admin-login-form > label > input, .password-field { width: 100%; min-height: 43px; border: 1px solid #46564b; border-radius: 3px; color: #f2f5ef; background: #111815; }.admin-login-form > label > input { padding: 0 12px; outline: none; }.admin-login-form input:focus { border-color: #a4c19e; box-shadow: 0 0 0 2px #a4c19e22; }.admin-login-form input::placeholder { color: #79867d; }
.password-field { display: flex; align-items: center; }.password-field input { width: 100%; min-width: 0; height: 41px; border: 0; outline: none; padding: 0 12px; color: inherit; background: transparent; }.password-field button { display: grid; width: 40px; height: 40px; flex: 0 0 auto; place-items: center; border: 0; color: #a2afa5; background: transparent; cursor: pointer; }
.login-error { margin: 0 0 13px; color: #ff9c8e; font-size: 10px; }.login-submit { display: flex; min-height: 44px; align-items: center; justify-content: center; gap: 9px; margin-top: 4px; border: 0; border-radius: 3px; color: #1c2119; background: #e5c76a; cursor: pointer; font-size: 11px; font-weight: 700; }.login-submit:hover:not(:disabled) { background: #f0d985; }.login-submit:disabled { cursor: wait; opacity: .6; }
.login-footnote { display: flex; align-items: flex-start; gap: 7px; margin-top: 19px; color: #a2afa5; font-size: 9px; line-height: 1.6; }.login-footnote svg { flex: 0 0 auto; color: #8bc89c; }.mfa-not-ready { margin: 17px 0 0; border-top: 1px solid #35443b; padding-top: 13px; color: #d5bd75; font-size: 9px; line-height: 1.5; }
.login-footer { display: flex; width: min(860px, 100%); justify-content: space-between; gap: 20px; margin: 20px auto 0; color: #77847b; font-size: 9px; }
@media (max-width: 680px) { .admin-login-page { justify-content: flex-start; padding: 74px 16px 28px; }.return-shop { top: 25px; left: 17px; }.admin-login-shell { max-width: 430px; grid-template-columns: 1fr; }.login-brand-panel { padding: 22px 22px 20px; border-right: 0; border-bottom: 1px solid #35443b; }.login-brand-mark { width: 37px; height: 37px; margin-bottom: 14px; }.login-brand-panel h1 { margin: 8px 0; font-size: 25px; }.login-brand-panel h1 br { display: none; }.login-brand-panel > p { max-width: 100%; font-size: 10px; }.login-security-note { margin-top: 13px; }.admin-login-form { padding: 24px 22px 25px; }.form-heading { margin-bottom: 20px; }.login-footer { max-width: 430px; font-size: 8px; } }
</style>
