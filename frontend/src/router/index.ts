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
    { path: '/login', component: () => import('../views/AuthView.vue') },
    { path: '/register', component: () => import('../views/AuthView.vue') },
    { path: '/account', component: () => import('../views/AccountView.vue') },
    { path: '/escrow', component: () => import('../views/EscrowView.vue') },
    { path: '/escrow/:orderNumber', component: () => import('../views/EscrowView.vue') },
    { path: '/admin/login', component: () => import('../views/AdminLoginView.vue'), meta: { adminLogin: true } },
    { path: '/admin', component: () => import('../views/AdminView.vue'), meta: { admin: true } },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (!auth.checked) await auth.fetchMe();

  if (to.meta.admin) {
    if (auth.user?.role !== 'ADMIN') return { path: '/admin/login', query: { redirect: to.fullPath } };
    return true;
  }

  // If user visits /login or /register while already signed in, redirect them
  if ((to.path === '/login' || to.path === '/register') && auth.user) {
    const redirect = typeof to.query.redirect === 'string' && to.query.redirect.startsWith('/') ? to.query.redirect : '/account';
    return { path: redirect };
  }

  // If user visits /account while not signed in, take them to login with redirect
  if (to.path === '/account' && !auth.user) {
    return { path: '/login', query: { redirect: '/account' } };
  }

  return true;
});

export default router;