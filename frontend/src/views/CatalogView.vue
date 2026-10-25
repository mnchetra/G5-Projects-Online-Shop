<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import { Search, SlidersHorizontal, X } from 'lucide-vue-next';
import ProductCard from '../components/ProductCard.vue';
import { categories, products as fallbackProducts, type Product } from '../data/products';
import { api } from '../services/api';

const { t, locale } = useI18n();
const route = useRoute();
const router = useRouter();
const allProducts = ref<Product[]>(fallbackProducts);
const search = ref(typeof route.query.search === 'string' ? route.query.search : '');
const category = ref(typeof route.query.category === 'string' ? route.query.category : '');
const sort = ref('newest');
const minPrice = ref('');
const maxPrice = ref('');
const page = ref(1);
const pageSize = 8;
const loading = ref(false);

onMounted(async () => {
  loading.value = true;
  try {
    const { data } = await api.get('/products', { params: { pageSize: 48 } });
    allProducts.value = data.data.items.map((item: Record<string, unknown>) => ({ ...item, featured: item.isFeatured, category: (item.category as { slug: string }).slug, images: ((item.images as { url: string }[]) || []).map((image) => image.url) })) as Product[];
  } catch { /* The bundled catalog keeps the storefront usable during first setup. */ }
  finally { loading.value = false; }
});

const filtered = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  let result = allProducts.value.filter((product) => {
    const text = `${product.nameEn} ${product.nameKm} ${product.descriptionEn}`.toLocaleLowerCase();
    return (!query || text.includes(query)) && (!category.value || product.category === category.value) && (!minPrice.value || product.price >= Number(minPrice.value)) && (!maxPrice.value || product.price <= Number(maxPrice.value));
  });
  if (sort.value === 'low') result = [...result].sort((a, b) => a.price - b.price);
  if (sort.value === 'high') result = [...result].sort((a, b) => b.price - a.price);
  return result;
});
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)));
const visible = computed(() => filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize));
watch([search, category, minPrice, maxPrice, sort], () => { page.value = 1; });
watch(() => route.query.category, (value) => { category.value = typeof value === 'string' ? value : ''; });

function clearFilters() {
  search.value = ''; category.value = ''; minPrice.value = ''; maxPrice.value = ''; sort.value = 'newest';
  router.replace({ path: '/shop' });
}
</script>

<template>
  <section class="catalog-page page-wrap">
    <div class="catalog-intro"><span class="section-kicker">{{ t('catalog.eyebrow') }}</span><h1>{{ t('catalog.title') }}</h1><p>{{ t('catalog.description') }}</p></div>
    <div class="catalog-toolbar">
      <label class="search-field"><Search :size="18" /><input v-model="search" type="search" :placeholder="t('catalog.search')" :aria-label="t('catalog.search')" /><button v-if="search" type="button" :aria-label="t('common.close')" @click="search = ''"><X :size="16" /></button></label>
      <label class="filter-control"><span>{{ t('catalog.category') }}</span><select v-model="category"><option value="">{{ t('catalog.category') }}</option><option v-for="item in categories" :key="item.slug" :value="item.slug">{{ locale === 'km' ? item.nameKm : item.nameEn }}</option></select></label>
      <label class="filter-control price-filter"><span>{{ t('catalog.price') }}</span><div><input v-model="minPrice" type="number" min="0" placeholder="$ min" /><span>–</span><input v-model="maxPrice" type="number" min="0" placeholder="$ max" /></div></label>
      <label class="filter-control sort-control"><span><SlidersHorizontal :size="14" /> {{ t('catalog.sort') }}</span><select v-model="sort"><option value="newest">{{ t('catalog.newest') }}</option><option value="low">{{ t('catalog.lowHigh') }}</option><option value="high">{{ t('catalog.highLow') }}</option></select></label>
    </div>
    <div class="catalog-result-line"><span>{{ t('catalog.results', { count: filtered.length }) }}</span><button v-if="search || category || minPrice || maxPrice" class="clear-filter" type="button" @click="clearFilters">{{ t('catalog.clear') }} <X :size="14" /></button></div>
    <div v-if="loading" class="loading-state">{{ t('common.loading') }}</div>
    <div v-else-if="visible.length" class="product-grid catalog-grid"><ProductCard v-for="item in visible" :key="item.id" :product="item" /></div>
    <div v-else class="empty-state"><span class="empty-icon"><Search :size="22" /></span><p>{{ t('catalog.empty') }}</p><button type="button" class="text-action" @click="clearFilters">{{ t('catalog.clear') }}</button></div>
    <div v-if="pages > 1" class="pagination"><button type="button" :disabled="page === 1" @click="page--">{{ t('catalog.previous') }}</button><span>{{ page }} / {{ pages }}</span><button type="button" :disabled="page === pages" @click="page++">{{ t('catalog.next') }}</button></div>
  </section>
</template>