import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { HttpError, success } from '../utils/http.js';

export async function addresses(req: Request, res: Response) {
  const items = await prisma.address.findMany({ where: { userId: req.auth!.userId }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  res.json(success(items));
}

export async function addAddress(req: Request, res: Response) {
  const item = await prisma.address.create({ data: { ...req.body, userId: req.auth!.userId } });
  res.status(201).json(success(item));
}

export async function updateProfile(req: Request, res: Response) {
  const item = await prisma.user.update({ where: { id: req.auth!.userId }, data: req.body, select: { id: true, name: true, email: true, phone: true, role: true } });
  if (!item) throw new HttpError(404, 'Account not found');
  res.json(success({ user: item }));
}