<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';
import SiteHeader from './components/SiteHeader.vue';
const { t } = useI18n();
const route = useRoute();
</script>

<template>
  <SiteHeader v-if="!route.meta.admin && !route.meta.adminLogin" />
  <main><RouterView /></main>
  <footer v-if="!route.meta.admin && !route.meta.adminLogin" class="site-footer">
    <div class="footer-main"><div><RouterLink to="/" class="footer-brand">{{ t('brand') }}</RouterLink><p>{{ t('home.description') }}</p></div><div class="footer-links"><RouterLink to="/shop">{{ t('nav.shop') }}</RouterLink><RouterLink to="/account">{{ t('nav.account') }}</RouterLink><a href="mailto:hello@mekong.market">hello@mekong.market</a></div></div>
    <div class="footer-bottom"><span>© 2026 {{ t('brand') }}</span><span>{{ t('common.footer') }}</span></div>
  </footer>
</template>