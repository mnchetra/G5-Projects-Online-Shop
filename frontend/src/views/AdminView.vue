<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { setLocale } from '../i18n';
import { Boxes, ClipboardList, UsersRound, Plus, X, Trash2, Pencil, Tags, ShieldCheck, LayoutDashboard, Warehouse, BarChart3, CreditCard, BadgePercent, Truck, Star, Bell, FileText, ScrollText, Settings, Sun, Moon } from 'lucide-vue-next';
import AdminOrdersTable from '../components/AdminOrdersTable.vue';
import AdminSecurityCenter, { type AdminSecuritySection } from '../components/AdminSecurityCenter.vue';
import AdminCommerceWorkspace, { type CommerceWorkspaceSection } from '../components/AdminCommerceWorkspace.vue';
import AdminEscrowDesk from '../components/AdminEscrowDesk.vue';
import { api, apiErrorMessage } from '../services/api';
import type { Product } from '../data/products';

type AdminOrder = { id: string; orderNumber: string; customerName: string; customerPhone: string; total: number; status: string; createdAt: string; payment?: { status: string; method: string; amount: number; providerRef?: string | null } | null };
type AdminCategory = { id: string; slug: string; nameEn: string; nameKm: string; descriptionEn?: string | null; descriptionKm?: string | null; imageUrl?: string | null; sortOrder: number };
type AdminProduct = Product & { categoryId: string; isActive: boolean; imageRecords: { id: string; url: string }[] };

const { t, locale } = useI18n();
const tab = ref('dashboard');
const isLight = ref(false);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const showProductForm = ref(false);
const showCategoryForm = ref(false);
const editingProductId = ref<string | null>(null);
const editingCategoryId = ref<string | null>(null);
const imageFile = ref<File | null>(null);
const stats = ref({ orders: 0, customers: 0, products: 0, revenue: 0 });
const products = ref<AdminProduct[]>([]);
const orders = ref<AdminOrder[]>([]);
const customers = ref<{ id: string; name: string; email: string; phone?: string; createdAt?: string; _count: { orders: number } }[]>([]);
const categories = ref<AdminCategory[]>([]);
const form = reactive({ slug: '', sku: '', nameEn: '', nameKm: '', descriptionEn: '', descriptionKm: '', price: 0, stock: 0, categoryId: '', imageUrl: '', isFeatured: false, isActive: true });
const categoryForm = reactive({ slug: '', nameEn: '', nameKm: '', descriptionEn: '', descriptionKm: '', imageUrl: '', sortOrder: 0 });
const editingProduct = computed(() => products.value.find((product) => product.id === editingProductId.value));
const commerceSection = computed(() => tab.value as CommerceWorkspaceSection);
const securitySection = computed<AdminSecuritySection>(() => tab.value === 'users-roles' ? 'users' : tab.value === 'audit' ? 'audit' : 'overview');
const tabs = computed(() => [
  { id: 'dashboard', label: locale.value === 'km' ? 'ផ្ទាំងគ្រប់គ្រង' : 'Dashboard', icon: LayoutDashboard },
  { id: 'escrow', label: locale.value === 'km' ? 'ធានាប្រាក់ Escrow' : 'Bakong Escrow Desk', icon: ShieldCheck },
  { id: 'orders', label: t('admin.orders'), icon: ClipboardList },
  { id: 'products', label: t('admin.products'), icon: Boxes },
  { id: 'categories', label: t('admin.categories'), icon: Tags },
  { id: 'customers', label: t('admin.customers'), icon: UsersRound },
  { id: 'inventory', label: locale.value === 'km' ? 'សារពើភ័ណ្ឌ' : 'Inventory', icon: Warehouse },
  { id: 'sales', label: locale.value === 'km' ? 'ការលក់ និងចំណូល' : 'Sales & revenue', icon: BarChart3 },
  { id: 'payments', label: locale.value === 'km' ? 'ការទូទាត់' : 'Payments', icon: CreditCard },
  { id: 'discounts', label: locale.value === 'km' ? 'ការបញ្ចុះតម្លៃ និងគូប៉ុង' : 'Discounts & coupons', icon: BadgePercent },
  { id: 'shipping', label: locale.value === 'km' ? 'ការដឹកជញ្ជូន' : 'Shipping', icon: Truck },
  { id: 'reviews', label: locale.value === 'km' ? 'ការវាយតម្លៃ' : 'Reviews', icon: Star },
  { id: 'notifications', label: locale.value === 'km' ? 'ការជូនដំណឹង' : 'Notifications', icon: Bell },
  { id: 'reports', label: locale.value === 'km' ? 'របាយការណ៍' : 'Reports', icon: FileText },
  { id: 'security', label: locale.value === 'km' ? 'សុវត្ថិភាព' : 'Security center', icon: ShieldCheck },
  { id: 'users-roles', label: locale.value === 'km' ? 'អ្នកប្រើប្រាស់ និងតួនាទី' : 'Users & roles', icon: UsersRound },
  { id: 'audit', label: locale.value === 'km' ? 'កំណត់ហេតុសវនកម្ម' : 'Audit logs', icon: ScrollText },
  { id: 'settings', label: locale.value === 'km' ? 'ការកំណត់' : 'Settings', icon: Settings }
]);

onMounted(loadDashboard);

async function loadDashboard() {
  loading.value = true;
  error.value = '';
  try {
    const [overview, productResponse, orderResponse, customerResponse, categoryResponse] = await Promise.all([
      api.get('/admin/dashboard'),
      api.get('/products', { params: { pageSize: 48 } }),
      api.get('/admin/orders'),
      api.get('/admin/customers'),
      api.get('/categories')
    ]);
    stats.value = overview.data.data;
    products.value = productResponse.data.data.items.map((item: Record<string, unknown>) => ({
      ...item,
      featured: item.isFeatured,
      category: (item.category as { slug: string }).slug,
      categoryId: item.categoryId as string,
      imageRecords: (item.images as { id: string; url: string }[]) || [],
      images: ((item.images as { url: string }[]) || []).map((image) => image.url),
      isActive: item.isActive as boolean
    })) as AdminProduct[];
    orders.value = orderResponse.data.data;
    customers.value = customerResponse.data.data;
    categories.value = categoryResponse.data.data;
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  } finally {
    loading.value = false;
  }
}

function openProductForm(product?: AdminProduct) {
  editingProductId.value = product?.id ?? null;
  imageFile.value = null;
  Object.assign(form, product ? {
    slug: product.slug, sku: product.sku, nameEn: product.nameEn, nameKm: product.nameKm,
    descriptionEn: product.descriptionEn, descriptionKm: product.descriptionKm,
    price: Number(product.price), stock: product.stock, categoryId: product.categoryId,
    imageUrl: product.images[0] || '', isFeatured: product.featured, isActive: product.isActive
  } : {
    slug: '', sku: '', nameEn: '', nameKm: '', descriptionEn: '', descriptionKm: '',
    price: 0, stock: 0, categoryId: categories.value[0]?.id || '', imageUrl: '', isFeatured: false, isActive: true
  });
  showProductForm.value = true;
}

function selectImage(event: Event) {
  imageFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

async function saveProduct() {
  busy.value = true;
  error.value = '';
  try {
    const payload = { ...form, imageUrl: form.imageUrl || undefined };
    const { data } = editingProductId.value
      ? await api.put(`/admin/products/${editingProductId.value}`, payload)
      : await api.post('/admin/products', payload);
    if (imageFile.value) {
      const upload = new FormData();
      upload.append('image', imageFile.value);
      await api.post(`/admin/products/${data.data.id}/images`, upload, { headers: { 'Content-Type': 'multipart/form-data' } });
    }
    showProductForm.value = false;
    await loadDashboard();
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  } finally {
    busy.value = false;
  }
}

async function removeProduct(product: AdminProduct) {
  if (!window.confirm(locale.value === 'km' ? 'ដកទំនិញនេះចេញមែនទេ?' : `Archive ${product.nameEn} from the shop?`)) return;
  try {
    await api.delete(`/admin/products/${product.id}`);
    await loadDashboard();
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  }
}

async function removeImage(productId: string, imageId: string) {
  try {
    await api.delete(`/admin/products/${productId}/images/${imageId}`);
    await loadDashboard();
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  }
}

function openCategoryForm(category?: AdminCategory) {
  editingCategoryId.value = category?.id ?? null;
  Object.assign(categoryForm, category ? {
    slug: category.slug, nameEn: category.nameEn, nameKm: category.nameKm,
    descriptionEn: category.descriptionEn || '', descriptionKm: category.descriptionKm || '', imageUrl: category.imageUrl || '', sortOrder: category.sortOrder
  } : {
    slug: '', nameEn: '', nameKm: '', descriptionEn: '', descriptionKm: '',
    imageUrl: '', sortOrder: categories.value.length
  });
  showCategoryForm.value = true;
}

async function saveCategory() {
  busy.value = true;
  error.value = '';
  try {
    const payload = { ...categoryForm, imageUrl: categoryForm.imageUrl || undefined };
    if (editingCategoryId.value) await api.put(`/admin/categories/${editingCategoryId.value}`, payload);
    else await api.post('/admin/categories', payload);
    showCategoryForm.value = false;
    await loadDashboard();
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  } finally {
    busy.value = false;
  }
}

async function removeCategory(category: AdminCategory) {
  if (!window.confirm(locale.value === 'km' ? 'លុបប្រភេទទំនិញនេះមែនទេ?' : `Delete ${category.nameEn}?`)) return;
  try {
    await api.delete(`/admin/categories/${category.id}`);
    await loadDashboard();
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  }
}

async function updateStatus(order: AdminOrder, status: string) {
  try {
    await api.patch(`/admin/orders/${order.id}/status`, { status });
    order.status = status;
  } catch (exception) {
    error.value = apiErrorMessage(exception);
  }
}

const money = (value: number) => new Intl.NumberFormat(locale.value === 'km' ? 'km-KH' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(Number(value));
const date = (value: string) => new Intl.DateTimeFormat(locale.value === 'km' ? 'km-KH' : 'en-US', { dateStyle: 'medium' }).format(new Date(value));
</script>

<template>
  <section class="admin-page" :class="{ 'admin-light': isLight }">
    <aside class="admin-sidebar">
      <RouterLink to="/" class="admin-brand">{{ t('brand') }}<span>{{ t('admin.marketDesk') }}</span></RouterLink>
      <nav>
        <button v-for="item in tabs" :key="item.id" type="button" :class="{ selected: tab === item.id }" @click="tab = item.id">
          <component :is="item.icon" :size="18" />{{ item.label }}
        </button>
      </nav>
      <div class="admin-sidebar-bottom"><span class="online-mark"></span>{{ t('admin.online') }}</div>
    </aside>

    <div class="admin-main">
      <header class="admin-topbar"><div><span class="section-kicker">{{ t('admin.title') }}</span><h1>{{ tabs.find((item) => item.id === tab)?.label }}</h1></div><div class="admin-topbar-actions"><button class="admin-language-toggle" type="button" :aria-label="locale === 'km' ? 'Switch to English' : 'ប្តូរទៅភាសាខ្មែរ'" @click="setLocale(locale === 'km' ? 'en' : 'km')">{{ locale === 'km' ? 'EN' : 'ខ្មែរ' }}</button><button class="admin-theme-toggle" type="button" :aria-label="isLight ? 'Switch to dark mode' : 'Switch to light mode'" :title="isLight ? 'Switch to dark mode' : 'Switch to light mode'" @click="isLight = !isLight"><Sun v-if="!isLight" :size="15" /><Moon v-else :size="15" /></button><RouterLink to="/" class="text-action">{{ t('nav.shop') }} <span aria-hidden="true">↗</span></RouterLink></div></header>
      <p v-if="error" class="form-error admin-error" role="alert">{{ error }}</p>
      <div v-if="loading" class="loading-state">{{ t('common.loading') }}</div>

      <template v-else-if="tab === 'security'"><AdminSecurityCenter :initial-section="securitySection" :light-mode="isLight" @toggle-light="isLight = !isLight" /></template>

      <template v-else-if="tab === 'users-roles'"><AdminSecurityCenter initial-section="users" :light-mode="isLight" @toggle-light="isLight = !isLight" /></template>

      <template v-else-if="tab === 'audit'"><AdminSecurityCenter initial-section="audit" :light-mode="isLight" @toggle-light="isLight = !isLight" /></template>

      <template v-else-if="tab === 'dashboard'"><AdminCommerceWorkspace section="dashboard" :locale="locale" :light-mode="isLight" :stats="stats" :products="products" :orders="orders" :customers="customers" @navigate="tab = $event" /></template>

      <template v-else-if="tab === 'escrow'"><AdminEscrowDesk :locale="locale" :light-mode="isLight" /></template>

      <template v-else-if="tab === 'products'">
        <div class="admin-actions-row"><p>{{ products.length }} {{ t('admin.products').toLowerCase() }}</p><button class="button button-dark" type="button" @click="openProductForm()"><Plus :size="16" />{{ t('admin.addProduct') }}</button></div>
        <div class="admin-product-list">
          <article v-for="product in products" :key="product.id" class="admin-product-row">
            <img :src="product.images[0]" :alt="locale === 'km' ? product.nameKm : product.nameEn" />
            <div class="admin-product-name"><strong>{{ locale === 'km' ? product.nameKm : product.nameEn }}</strong><span>{{ product.sku }} · {{ locale === 'km' ? categories.find((item) => item.id === product.categoryId)?.nameKm : categories.find((item) => item.id === product.categoryId)?.nameEn }}</span></div>
            <span>{{ money(product.price) }}</span><span>{{ product.stock }} · {{ t('admin.stock').toLowerCase() }}</span>
            <div class="row-actions"><button class="icon-link" type="button" :aria-label="`${t('admin.edit')} ${product.nameEn}`" @click="openProductForm(product)"><Pencil :size="16" /></button><button class="icon-link danger-icon" type="button" :aria-label="`${t('admin.archive')} ${product.nameEn}`" @click="removeProduct(product)"><Trash2 :size="16" /></button></div>
          </article>
        </div>
      </template>

      <template v-else-if="tab === 'orders'"><div class="admin-table-section"><AdminOrdersTable :orders="orders" :money="money" :date="date" :editable="true" @status="updateStatus" /></div></template>

      <template v-else-if="tab === 'customers'">
        <div class="admin-table-section"><table class="orders-table customer-admin-table"><thead><tr><th>{{ t('admin.customer') }}</th><th>{{ t('checkout.email') }}</th><th>{{ t('checkout.phone') }}</th><th>{{ t('admin.orders') }}</th></tr></thead><tbody><tr v-for="customer in customers" :key="customer.id"><td>{{ customer.name }}</td><td>{{ customer.email }}</td><td>{{ customer.phone || '—' }}</td><td>{{ customer._count.orders }}</td></tr></tbody></table><p v-if="!customers.length" class="muted-empty">{{ t('admin.empty') }}</p></div>
      </template>

      <template v-else-if="tab === 'categories'">
        <div class="admin-actions-row"><p>{{ categories.length }} {{ t('admin.categories').toLowerCase() }}</p><button class="button button-dark" type="button" @click="openCategoryForm()"><Plus :size="16" />{{ t('admin.addCategory') }}</button></div>
        <div class="admin-product-list"><article v-for="category in categories" :key="category.id" class="admin-product-row category-admin-row"><div class="category-swatch"><Tags :size="18" /></div><div class="admin-product-name"><strong>{{ locale === 'km' ? category.nameKm : category.nameEn }}</strong><span>{{ category.slug }} · {{ category.sortOrder }}</span></div><span>{{ category.imageUrl ? t('admin.imageSet') : '' }}</span><div class="row-actions"><button class="icon-link" type="button" :aria-label="`${t('admin.edit')} ${category.nameEn}`" @click="openCategoryForm(category)"><Pencil :size="16" /></button><button class="icon-link danger-icon" type="button" :aria-label="`${t('admin.delete')} ${category.nameEn}`" @click="removeCategory(category)"><Trash2 :size="16" /></button></div></article></div>
      </template>

      <template v-else><AdminCommerceWorkspace :section="commerceSection" :locale="locale" :light-mode="isLight" :stats="stats" :products="products" :orders="orders" :customers="customers" /></template>
    </div>

    <div v-if="showProductForm" class="modal-backdrop" @click.self="showProductForm = false">
      <form class="product-modal" @submit.prevent="saveProduct">
        <div class="modal-heading"><div><span class="section-kicker">{{ t('admin.newProduct') }}</span><h2>{{ editingProductId ? t('admin.editProduct') : t('admin.addProduct') }}</h2></div><button type="button" class="icon-link" :aria-label="t('common.close')" @click="showProductForm = false"><X :size="19" /></button></div>
        <div class="form-grid">
          <label class="form-field"><span>{{ t('admin.nameEn') }}</span><input v-model.trim="form.nameEn" required /></label>
          <label class="form-field"><span>{{ t('admin.nameKm') }}</span><input v-model.trim="form.nameKm" required lang="km" /></label>
          <label class="form-field"><span>{{ t('admin.slug') }}</span><input v-model.trim="form.slug" pattern="[a-z0-9-]+" required /></label>
          <label class="form-field"><span>{{ t('admin.sku') }}</span><input v-model.trim="form.sku" required /></label>
          <label class="form-field"><span>{{ t('admin.price') }}</span><input v-model.number="form.price" type="number" min="0.01" step="0.01" required /></label>
          <label class="form-field"><span>{{ t('admin.stockCount') }}</span><input v-model.number="form.stock" type="number" min="0" step="1" required /></label>
          <label class="form-field span-two"><span>{{ t('admin.category') }}</span><select v-model="form.categoryId" required><option v-for="category in categories" :key="category.id" :value="category.id">{{ locale === 'km' ? category.nameKm : category.nameEn }}</option></select></label>
          <label class="form-field span-two"><span>{{ t('admin.image') }}</span><input v-model.trim="form.imageUrl" type="url" /><small>{{ t('admin.imageUrlHint') }}</small></label>
          <label class="form-field span-two"><span>{{ t('admin.uploadImage') }}</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" @change="selectImage" /><small>{{ t('admin.imageUploadHint') }}</small></label>
          <label class="form-field span-two"><span>{{ t('admin.descriptionEn') }}</span><textarea v-model.trim="form.descriptionEn" rows="3" required /></label>
          <label class="form-field span-two"><span>{{ t('admin.descriptionKm') }}</span><textarea v-model.trim="form.descriptionKm" rows="3" required lang="km" /></label>
          <label class="admin-checkbox"><input v-model="form.isFeatured" type="checkbox" />{{ t('admin.featured') }}</label><label class="admin-checkbox"><input v-model="form.isActive" type="checkbox" />{{ t('admin.active') }}</label>
        </div>
        <div v-if="editingProduct && editingProduct.imageRecords.length" class="image-manager"><strong>{{ t('admin.images') }}</strong><div v-for="image in editingProduct.imageRecords" :key="image.id" class="managed-image"><img :src="image.url" alt="" /><button class="icon-link danger-icon" type="button" :aria-label="t('admin.removeImage')" @click="removeImage(editingProduct.id, image.id)"><Trash2 :size="15" /></button></div></div>
        <p v-if="error" class="form-error">{{ error }}</p>
        <div class="modal-actions"><button class="button button-outline" type="button" @click="showProductForm = false">{{ t('admin.cancel') }}</button><button class="button button-dark" type="submit" :disabled="busy">{{ busy ? t('common.loading') : t('admin.save') }}</button></div>
      </form>
    </div>

    <div v-if="showCategoryForm" class="modal-backdrop" @click.self="showCategoryForm = false">
      <form class="product-modal category-modal" @submit.prevent="saveCategory">
        <div class="modal-heading"><div><span class="section-kicker">{{ t('admin.categories') }}</span><h2>{{ editingCategoryId ? t('admin.editCategory') : t('admin.addCategory') }}</h2></div><button type="button" class="icon-link" :aria-label="t('common.close')" @click="showCategoryForm = false"><X :size="19" /></button></div>
        <div class="form-grid"><label class="form-field"><span>{{ t('admin.nameEn') }}</span><input v-model.trim="categoryForm.nameEn" required /></label><label class="form-field"><span>{{ t('admin.nameKm') }}</span><input v-model.trim="categoryForm.nameKm" lang="km" required /></label><label class="form-field span-two"><span>{{ t('admin.slug') }}</span><input v-model.trim="categoryForm.slug" pattern="[a-z0-9-]+" required /></label><label class="form-field span-two"><span>{{ t('admin.categoryDescriptionEn') }}</span><textarea v-model.trim="categoryForm.descriptionEn" rows="2" /></label><label class="form-field span-two"><span>{{ t('admin.categoryDescriptionKm') }}</span><textarea v-model.trim="categoryForm.descriptionKm" rows="2" lang="km" /></label><label class="form-field span-two"><span>{{ t('admin.image') }}</span><input v-model.trim="categoryForm.imageUrl" type="url" /></label><label class="form-field span-two"><span>{{ t('admin.sortOrder') }}</span><input v-model.number="categoryForm.sortOrder" type="number" min="0" step="1" required /></label></div>
        <p v-if="error" class="form-error">{{ error }}</p><div class="modal-actions"><button class="button button-outline" type="button" @click="showCategoryForm = false">{{ t('admin.cancel') }}</button><button class="button button-dark" type="submit" :disabled="busy">{{ busy ? t('common.loading') : t('admin.save') }}</button></div>
      </form>
    </div>
  </section>
</template>