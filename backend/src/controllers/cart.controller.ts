import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError, success } from '../utils/http.js';

export async function getCart(req: Request, res: Response) {
  const cart = await prisma.cart.upsert({ where: { userId: req.auth!.userId }, create: { userId: req.auth!.userId }, update: {}, include: { items: { include: { product: { include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } } } } } } });
  res.json(success(cart));
}

export async function addItem(req: Request, res: Response) {
  const { productId, quantity } = req.body as { productId: string; quantity: number };
  const product = await prisma.product.findFirst({ where: { id: productId, isActive: true } });
  if (!product) throw new HttpError(404, 'Product not found');
  if (product.stock < quantity) throw new HttpError(409, 'Not enough stock available');
  const cart = await prisma.cart.upsert({ where: { userId: req.auth!.userId }, create: { userId: req.auth!.userId }, update: {} });
  await prisma.cartItem.upsert({ where: { cartId_productId: { cartId: cart.id, productId } }, create: { cartId: cart.id, productId, quantity }, update: { quantity: { increment: quantity } } });
  res.status(201).json(success({ added: true }));
}

export async function updateItem(req: Request, res: Response) {
  const item = await prisma.cartItem.findFirst({ where: { id: req.params.id, cart: { userId: req.auth!.userId } }, include: { product: true } });
  if (!item) throw new HttpError(404, 'Cart item not found');
  const quantity = req.body.quantity as number;
  if (quantity > item.product.stock) throw new HttpError(409, 'Not enough stock available');
  await prisma.cartItem.update({ where: { id: item.id }, data: { quantity } });
  res.json(success({ updated: true }));
}

export async function removeItem(req: Request, res: Response) {
  await prisma.cartItem.deleteMany({ where: { id: req.params.id, cart: { userId: req.auth!.userId } } });
  res.json(success({ removed: true }));
}