<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowUpRight, ArrowRight, PackageCheck, HandHeart, Sparkles } from 'lucide-vue-next';
import ProductCard from '../components/ProductCard.vue';
import { categories, products } from '../data/products';

const { t, locale } = useI18n();
const featured = computed(() => products.filter((product) => product.featured).slice(0, 4));
const newArrivals = computed(() => products.slice(-4));
const categoryCards = computed(() => categories.filter((category) => category.slug !== 'pantry').map((category) => ({
  ...category,
  productCount: products.filter((product) => product.category === category.slug).length
})));
</script>

<template>
  <div class="home-page">
    <section class="hero-shell">
      <div class="hero-copy">
        <span class="eyebrow"><span class="eyebrow-mark"></span>{{ t('home.eyebrow') }}</span>
        <h1>{{ t('home.title') }}</h1>
        <p>{{ t('home.description') }}</p>
        <div class="hero-actions"><RouterLink to="/shop" class="button button-dark">{{ t('home.shop') }} <ArrowUpRight :size="17" /></RouterLink><a href="#our-way" class="text-action">{{ t('home.story') }} <ArrowRight :size="16" /></a></div>
        <div class="hero-signoff"><span class="signoff-line"></span><span>{{ t('home.heroSignoff') }}</span></div>
      </div>
      <div class="hero-image"><img src="https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1500&q=90" alt="Sunlit home with handcrafted furniture and natural materials" /><div class="hero-image-note"><span>{{ t('home.heroLabel') }}</span><span>01 / 04</span></div></div>
      <span class="hero-stamp" aria-hidden="true">{{ t('home.stamp') }}</span>
    </section>

    <section class="category-section page-wrap">
      <div class="section-heading"><div><span class="section-kicker">{{ t('home.categoryKicker') }}</span><h2>{{ t('home.categories') }}</h2></div><RouterLink to="/shop" class="text-action">{{ t('home.viewAll') }} <ArrowRight :size="16" /></RouterLink></div>
      <div class="category-grid">
        <RouterLink v-for="(category, index) in categoryCards" :key="category.slug" :to="{ path: '/shop', query: { category: category.slug } }" class="category-tile" :class="`category-tile-${index + 1}`"><img :src="category.image" :alt="locale === 'km' ? category.nameKm : category.nameEn" loading="lazy" /><span class="category-caption"><span class="category-copy"><strong>{{ locale === 'km' ? category.nameKm : category.nameEn }}</strong><small>{{ category.productCount }} {{ locale === 'km' ? 'មុខទំនិញ' : category.productCount === 1 ? 'product' : 'products' }}</small></span><ArrowUpRight :size="17" /></span></RouterLink>
      </div>
    </section>

    <section class="product-section page-wrap">
      <div class="section-heading"><div><span class="section-kicker">{{ t('home.featuredKicker') }}</span><h2>{{ t('home.featured') }}</h2></div><RouterLink to="/shop" class="text-action">{{ t('home.viewAll') }} <ArrowRight :size="16" /></RouterLink></div>
      <div class="product-grid"> <ProductCard v-for="item in featured" :key="item.id" :product="item" :label="locale === 'km' ? 'ពេញនិយម' : 'A favorite'" /> </div>
    </section>

    <section id="our-way" class="maker-band">
      <div class="maker-image"><img src="https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=1100&q=85" alt="Artisan hands making a careful, handcrafted object" loading="lazy" /></div>
      <div class="maker-copy"><span class="section-kicker">{{ t('home.note') }}</span><h2>{{ t('home.noteText') }}</h2><p>{{ t('home.makerBody') }}</p><div class="maker-points"><span><HandHeart :size="18" /> {{ t('home.fair') }}</span><span><Sparkles :size="18" /> {{ t('home.kept') }}</span></div><RouterLink to="/shop" class="text-action">{{ t('home.story') }} <ArrowRight :size="16" /></RouterLink></div>
    </section>

    <section class="product-section page-wrap arrival-section">
      <div class="section-heading"><div><span class="section-kicker">{{ t('home.newKicker') }}</span><h2>{{ t('home.new') }}</h2></div><RouterLink to="/shop" class="text-action">{{ t('home.viewAll') }} <ArrowRight :size="16" /></RouterLink></div>
      <div class="product-grid"><ProductCard v-for="item in newArrivals" :key="item.id" :product="item" /></div>
    </section>
    <section class="delivery-strip"><div><PackageCheck :size="22" /><div><strong>{{ t('home.delivery') }}</strong><span>{{ t('home.deliveryText') }}</span></div></div><RouterLink to="/shop" class="button button-outline">{{ t('home.shop') }} <ArrowUpRight :size="16" /></RouterLink></section>
  </div>
</template>