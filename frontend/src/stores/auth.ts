import { ref } from 'vue';
import { defineStore } from 'pinia';
import { api } from '../services/api';

export type SessionUser = { id: string; name: string; email: string; phone?: string | null; role: 'CUSTOMER' | 'ADMIN' };

export const useAuthStore = defineStore('auth', () => {
  const user = ref<SessionUser | null>(null);
  const checked = ref(false);

  async function fetchMe() {
    try {
      const response = await api.get('/auth/me');
      user.value = response.data.data.user;
    } catch {
      user.value = null;
    } finally {
      checked.value = true;
    }
  }

  async function login(email: string, password: string) {
    const response = await api.post('/auth/login', { email, password });
    user.value = response.data.data.user;
    checked.value = true;
  }

  async function register(input: { name: string; email: string; phone: string; password: string }) {
    const response = await api.post('/auth/register', input);
    user.value = response.data.data.user;
    checked.value = true;
  }

  async function logout() {
    await api.post('/auth/logout');
    user.value = null;
  }

  return { user, checked, fetchMe, login, register, logout };
});