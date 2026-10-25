import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: () => import('../views/HomeView.vue') },
    { path: '/shop', component: () => import('../views/CatalogView.vue') },
    { path: '/product/:slug', component: () => import('../views/ProductView.vue') },
    { path: '/cart', component: () => import('../views/CartView.vue') },
    { path: '/checkout', component: () => import('../views/CheckoutView.vue') },
    { path: '/account', component: () => import('../views/AccountView.vue') },
    { path: '/admin/login', component: () => import('../views/AdminLoginView.vue'), meta: { adminLogin: true } },
    { path: '/admin', component: () => import('../views/AdminView.vue'), meta: { admin: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});

router.beforeEach(async (to) => {
  if (!to.meta.admin) return true;
  const auth = useAuthStore();
  if (!auth.checked) await auth.fetchMe();
  if (auth.user?.role !== 'ADMIN') return { path: '/admin/login', query: { redirect: to.fullPath } };
  return true;
});

export default router;