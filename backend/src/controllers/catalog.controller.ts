import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getProduct, listProducts } from '../services/catalog.service.js';
import { HttpError, success } from '../utils/http.js';

export async function products(req: Request, res: Response) {
  res.json(success(await listProducts(req.query)));
}

export async function product(req: Request, res: Response) {
  const item = await getProduct(req.params.id);
  if (!item) throw new HttpError(404, 'Product not found');
  res.json(success(item));
}

export async function categories(_req: Request, res: Response) {
  const items = await prisma.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { products: { where: { isActive: true } } } } } });
  res.json(success(items));
}