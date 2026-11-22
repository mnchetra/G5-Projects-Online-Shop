<script setup lang="ts">
import AdminLoginView from './AdminLoginView.vue';
import AdminView from './AdminView.vue';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
</script>

<template>
  <AdminView v-if="auth.user?.role === 'ADMIN' || auth.user?.role === 'SUPER_ADMIN'" />
  <AdminLoginView v-else />
</template>
