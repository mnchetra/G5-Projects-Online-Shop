import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function listProducts(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(48, Math.max(1, Number(query.pageSize) || 12));
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  const category = typeof query.category === 'string' ? query.category : undefined;
  const minPrice = Number(query.minPrice);
  const maxPrice = Number(query.maxPrice);
  const sort = query.sort === 'price-asc' ? { price: 'asc' as const } : query.sort === 'price-desc' ? { price: 'desc' as const } : { createdAt: 'desc' as const };
  const where: Prisma.ProductWhereInput = {
    isActive: true,
    ...(category ? { category: { slug: category } } : {}),
    ...(search ? { OR: [{ nameEn: { contains: search } }, { nameKm: { contains: search } }, { descriptionEn: { contains: search } }] } : {}),
    ...(Number.isFinite(minPrice) || Number.isFinite(maxPrice) ? { price: { ...(Number.isFinite(minPrice) ? { gte: minPrice } : {}), ...(Number.isFinite(maxPrice) ? { lte: maxPrice } : {}) } } : {})
  };
  const [items, total] = await Promise.all([
    prisma.product.findMany({ where, include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 }, category: true }, orderBy: sort, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.product.count({ where })
  ]);
  return { items, page, pageSize, total, pages: Math.ceil(total / pageSize) };
}

export async function getProduct(idOrSlug: string) {
  return prisma.product.findFirst({ where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }], isActive: true }, include: { images: { orderBy: { sortOrder: 'asc' } }, category: true } });
}