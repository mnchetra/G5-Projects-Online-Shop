<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { useCartStore } from '../stores/cart';
import { useAuthStore } from '../stores/auth';
import { setLocale } from '../i18n';
import { Search, ShoppingBag, UserRound, LogOut, Menu, X, Leaf } from 'lucide-vue-next';

const { t, locale } = useI18n();
const cart = useCartStore();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();
const menuOpen = ref(false);
const isShop = computed(() => route.path === '/shop');

function toggleLanguage() {
  setLocale(locale.value === 'en' ? 'km' : 'en');
}

async function signOut() {
  try { await auth.logout(); } finally { await router.push('/'); }
}
</script>

<template>
  <div class="announcement">{{ t('nav.announcement') }}</div>
  <header class="site-header">
    <div class="header-inner">
      <RouterLink to="/" class="brand" aria-label="Mekong Market home"><span class="brand-mark"><Leaf :size="18" /></span><span>{{ t('brand') }}</span></RouterLink>
      <nav class="main-nav" aria-label="Main navigation">
        <RouterLink to="/shop" :class="{ active: isShop }">{{ t('nav.shop') }}</RouterLink>
        <a href="/#our-way">{{ t('nav.story') }}</a>
      </nav>
      <div class="header-actions">
        <RouterLink to="/shop" class="icon-link search-link" :aria-label="t('nav.search')"><Search :size="19" /></RouterLink>
        <button class="language-switch" type="button" :aria-label="t('common.language')" @click="toggleLanguage">{{ locale === 'en' ? 'ខ្មែរ' : 'EN' }}</button>
        <RouterLink to="/account" class="icon-link account-link" :aria-label="t('nav.account')"><UserRound :size="19" /></RouterLink>
        <RouterLink v-if="auth.user?.role === 'ADMIN'" to="/admin" class="admin-link">{{ t('nav.admin') }}</RouterLink>
        <button v-if="auth.user" class="icon-link signout-link" :aria-label="t('account.signOut')" @click="signOut"><LogOut :size="18" /></button>
        <RouterLink to="/cart" class="bag-link" :aria-label="`${t('cart.title')}, ${cart.count} items`"><ShoppingBag :size="19" /><span class="bag-count">{{ cart.count }}</span></RouterLink>
        <button class="mobile-menu icon-link" type="button" :aria-label="menuOpen ? t('common.close') : t('nav.menu')" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen"><X v-if="menuOpen" :size="20" /><Menu v-else :size="20" /></button>
      </div>
    </div>
    <nav v-if="menuOpen" class="mobile-nav" aria-label="Mobile navigation">
      <RouterLink to="/shop" @click="menuOpen = false">{{ t('nav.shop') }}</RouterLink>
      <a href="/#our-way" @click="menuOpen = false">{{ t('nav.story') }}</a>
      <RouterLink to="/account" @click="menuOpen = false">{{ t('nav.account') }}</RouterLink>
      <RouterLink v-if="auth.user?.role === 'ADMIN'" to="/admin" @click="menuOpen = false">{{ t('nav.admin') }}</RouterLink>
    </nav>
  </header>
</template>