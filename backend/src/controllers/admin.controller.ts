import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError, success } from '../utils/http.js';

export async function dashboard(_req: Request, res: Response) {
  const [orders, customers, products, revenue, recentOrders] = await Promise.all([
    prisma.order.count(), prisma.user.count({ where: { role: 'CUSTOMER' } }), prisma.product.count(),
    prisma.order.aggregate({ where: { status: { not: 'CANCELLED' } }, _sum: { total: true } }),
    prisma.order.findMany({ take: 8, orderBy: { createdAt: 'desc' }, include: { items: true } })
  ]);
  res.json(success({ orders, customers, products, revenue: revenue._sum.total ?? new Prisma.Decimal(0), recentOrders }));
}

export async function adminOrders(_req: Request, res: Response) {
  res.json(success(await prisma.order.findMany({ take: 100, orderBy: { createdAt: 'desc' }, include: { items: true, payment: true } })));
}

export async function createProduct(req: Request, res: Response) {
  const { imageUrl, ...data } = req.body;
  const item = await prisma.product.create({ data: { ...data, price: new Prisma.Decimal(data.price), compareAtPrice: data.compareAtPrice ? new Prisma.Decimal(data.compareAtPrice) : null, ...(imageUrl ? { images: { create: { url: imageUrl } } } : {}) }, include: { images: true, category: true } });
  res.status(201).json(success(item));
}

export async function updateProduct(req: Request, res: Response) {
  const { imageUrl, ...data } = req.body;
  const item = await prisma.$transaction(async (tx) => {
    const current = await tx.product.findUnique({ where: { id: req.params.id } });
    if (!current) throw new HttpError(404, 'Product not found');
    await tx.product.update({ where: { id: current.id }, data: { ...data, price: new Prisma.Decimal(data.price), compareAtPrice: data.compareAtPrice ? new Prisma.Decimal(data.compareAtPrice) : null } });
    if (imageUrl) {
      const firstImage = await tx.productImage.findFirst({ where: { productId: current.id }, orderBy: { sortOrder: 'asc' } });
      if (firstImage) await tx.productImage.update({ where: { id: firstImage.id }, data: { url: imageUrl, altEn: data.nameEn, altKm: data.nameKm } });
      else await tx.productImage.create({ data: { productId: current.id, url: imageUrl, altEn: data.nameEn, altKm: data.nameKm } });
    }
    return tx.product.findUnique({ where: { id: current.id }, include: { images: true, category: true } });
  });
  res.json(success(item));
}

export async function deleteProduct(req: Request, res: Response) {
  await prisma.product.update({ where: { id: req.params.id }, data: { isActive: false } });
  res.json(success({ deleted: true }));
}

export async function adminCustomers(_req: Request, res: Response) {
  const items = await prisma.user.findMany({ where: { role: 'CUSTOMER' }, select: { id: true, name: true, email: true, phone: true, createdAt: true, _count: { select: { orders: true } } }, orderBy: { createdAt: 'desc' }, take: 100 });
  res.json(success(items));
}

export async function createCategory(req: Request, res: Response) {
  const item = await prisma.category.create({ data: req.body });
  res.status(201).json(success(item));
}

export async function updateCategory(req: Request, res: Response) {
  const item = await prisma.category.update({ where: { id: req.params.id }, data: req.body });
  res.json(success(item));
}

export async function deleteCategory(req: Request, res: Response) {
  const productCount = await prisma.product.count({ where: { categoryId: req.params.id } });
  if (productCount) throw new HttpError(409, 'Move products to another category before deleting this category');
  await prisma.category.delete({ where: { id: req.params.id } });
  res.json(success({ deleted: true }));
}

export async function addProductImage(req: Request, res: Response) {
  if (!req.file) throw new HttpError(400, 'Choose an image to upload');
  const detected = await fileTypeFromBuffer(req.file.buffer);
  if (!detected || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(detected.mime)) {
    throw new HttpError(400, 'The uploaded file is not a supported image');
  }
  const product = await prisma.product.findUnique({ where: { id: req.params.id }, select: { id: true, nameEn: true, nameKm: true } });
  if (!product) throw new HttpError(404, 'Product not found');
  const filename = `${randomUUID()}.${detected.ext}`;
  const directory = path.resolve(process.cwd(), 'uploads', 'products');
  await mkdir(directory, { recursive: true });
  const filePath = path.join(directory, filename);
  await writeFile(filePath, req.file.buffer, { flag: 'wx' });
  const baseUrl = process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;
  let image;
  try {
    image = await prisma.productImage.create({ data: { productId: product.id, url: `${baseUrl}/uploads/products/${filename}`, altEn: product.nameEn, altKm: product.nameKm } });
  } catch (error) {
    await unlink(filePath).catch(() => undefined);
    throw error;
  }
  res.status(201).json(success(image));
}

export async function removeProductImage(req: Request, res: Response) {
  const image = await prisma.productImage.findFirst({ where: { id: req.params.imageId, productId: req.params.id } });
  if (!image) throw new HttpError(404, 'Product image not found');
  await prisma.productImage.delete({ where: { id: image.id } });
  const publicOrigin = new URL(process.env.PUBLIC_API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`).origin;
  const imageUrl = new URL(image.url);
  const filename = path.basename(imageUrl.pathname);
  if (imageUrl.origin === publicOrigin && imageUrl.pathname.startsWith('/uploads/products/') && filename !== '.' && filename !== '/') {
    await unlink(path.resolve(process.cwd(), 'uploads', 'products', filename)).catch(() => undefined);
  }
  res.json(success({ removed: true }));
}