import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';
import type { Product } from '../data/products';

export type CartLine = { product: Product; quantity: number };

function readCart(): CartLine[] {
  try {
    return JSON.parse(localStorage.getItem('mekong-cart') || '[]') as CartLine[];
  } catch {
    return [];
  }
}

export const useCartStore = defineStore('cart', () => {
  const lines = ref<CartLine[]>(readCart());
  const count = computed(() => lines.value.reduce((sum, line) => sum + line.quantity, 0));
  const subtotal = computed(() => lines.value.reduce((sum, line) => sum + line.product.price * line.quantity, 0));

  watch(lines, (value) => localStorage.setItem('mekong-cart', JSON.stringify(value)), { deep: true });

  function add(product: Product, quantity = 1) {
    const current = lines.value.find((line) => line.product.id === product.id);
    if (current) current.quantity = Math.min(product.stock, current.quantity + quantity);
    else lines.value.push({ product, quantity: Math.min(product.stock, quantity) });
  }

  function setQuantity(productId: string, quantity: number) {
    const line = lines.value.find((item) => item.product.id === productId);
    if (!line) return;
    if (quantity < 1) remove(productId);
    else line.quantity = Math.min(line.product.stock, quantity);
  }

  function remove(productId: string) {
    lines.value = lines.value.filter((line) => line.product.id !== productId);
  }

  function clear() {
    lines.value = [];
  }

  return { lines, count, subtotal, add, setQuantity, remove, clear };
});