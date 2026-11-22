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

export async function wallet(req: Request, res: Response) {
  const [user, pendingTopUp] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        walletBalance: true,
        walletTransactions: {
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: {
            id: true,
            type: true,
            amount: true,
            balanceAfter: true,
            note: true,
            createdAt: true,
            order: { select: { orderNumber: true } }
          }
        }
      }
    }),
    prisma.walletTopUp.findFirst({
      where: { userId: req.auth!.userId, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, billNumber: true, amount: true, status: true, qrImage: true, expiresAt: true }
    })
  ]);
  if (!user) throw new HttpError(404, 'Account not found');
  res.json(success({ balance: user.walletBalance, transactions: user.walletTransactions, pendingTopUp }));
}