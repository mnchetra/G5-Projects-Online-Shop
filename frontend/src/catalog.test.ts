import { describe, expect, it } from 'vitest';
import { categories, productDescription, productName, products } from './data/products';

describe('bilingual market catalog', () => {
  it('provides English and Khmer names and descriptions for every sample product', () => {
    for (const product of products) {
      expect(productName(product, 'en')).toBeTruthy();
      expect(productName(product, 'km')).toBeTruthy();
      expect(productDescription(product, 'en')).toBeTruthy();
      expect(productDescription(product, 'km')).toBeTruthy();
    }
  });

  it('keeps product categories connected to a localized category entry', () => {
    for (const product of products) expect(categories.some((category) => category.slug === product.category)).toBe(true);
  });

  it('provides image-backed, populated cards for the nine requested store departments', () => {
    const requestedCategories = ['electronics', 'fashion', 'beauty-care', 'home-living', 'sports', 'accessories', 'shoes', 'computers', 'phones'];
    const cards = categories.filter((category) => requestedCategories.includes(category.slug));

    expect(cards).toHaveLength(9);
    for (const category of cards) {
      expect(category.image).toMatch(/^https:\/\//);
      expect(category.nameEn).toBeTruthy();
      expect(category.nameKm).toBeTruthy();
      expect(products.filter((product) => product.category === category.slug).length).toBeGreaterThan(0);
    }
  });
});