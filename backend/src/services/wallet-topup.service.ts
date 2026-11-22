import { randomUUID } from 'node:crypto';
import { WalletTopUpStatus, WalletTransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { checkBakongKhqr, createBakongKhqr } from './payment.service.js';
import { HttpError } from '../utils/http.js';

const topUpLifetimeMs = 15 * 60 * 1000;

export async function createWalletTopUp(userId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0 || Number(amount.toFixed(2)) !== amount) {
    throw new HttpError(400, 'Top-up amount must be a positive amount with at most two decimal places');
  }
  const pending = await prisma.walletTopUp.findFirst({
    where: { userId, status: WalletTopUpStatus.PENDING },
    orderBy: { createdAt: 'desc' }
  });
  if (pending) {
    if (pending.expiresAt > new Date()) throw new HttpError(409, 'A wallet top-up is already pending');
    await checkWalletTopUp(userId, pending.id);
    const refreshed = await prisma.walletTopUp.findUniqueOrThrow({ where: { id: pending.id } });
    if (refreshed.status === WalletTopUpStatus.PAID) throw new HttpError(409, 'The previous wallet top-up was paid and credited');
    if (refreshed.status === WalletTopUpStatus.PENDING) throw new HttpError(409, 'The previous wallet top-up is still being verified');
  }

  const billNumber = `WT-${Date.now().toString(36).toUpperCase()}-${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
  const expiresAt = new Date(Date.now() + topUpLifetimeMs);
  const topUp = await prisma.walletTopUp.create({
    data: { userId, billNumber, amount, expiresAt }
  });

  try {
    const qr = await createBakongKhqr({ orderNumber: billNumber, amount });
    const updated = await prisma.walletTopUp.update({
      where: { id: topUp.id },
      data: { providerRef: qr.md5, qrString: qr.qr, qrImage: qr.qrImage }
    });
    return {
      id: updated.id,
      billNumber: updated.billNumber,
      amount: updated.amount.toString(),
      status: updated.status,
      qrImage: updated.qrImage,
      expiresAt: updated.expiresAt
    };
  } catch (error) {
    await prisma.walletTopUp.update({
      where: { id: topUp.id },
      data: { status: WalletTopUpStatus.FAILED }
    });
    throw error;
  }
}

export async function checkWalletTopUp(userId: string, topUpId: string) {
  const topUp = await prisma.walletTopUp.findFirst({ where: { id: topUpId, userId } });
  if (!topUp) throw new HttpError(404, 'Wallet top-up not found');

  if ((topUp.status === WalletTopUpStatus.PENDING || topUp.status === WalletTopUpStatus.EXPIRED) && topUp.providerRef) {
    const result = await checkBakongKhqr(topUp.providerRef);
    if (result.paid) {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.walletTopUp.updateMany({
          where: { id: topUp.id, userId, status: { in: [WalletTopUpStatus.PENDING, WalletTopUpStatus.EXPIRED] } },
          data: { status: WalletTopUpStatus.PAID, paidAt: new Date() }
        });
        if (claimed.count === 0) return;

        const user = await tx.user.update({
          where: { id: userId },
          data: { walletBalance: { increment: topUp.amount } },
          select: { walletBalance: true }
        });
        await tx.walletTransaction.create({
          data: {
            userId,
            walletTopUpId: topUp.id,
            type: WalletTransactionType.KHQR_TOP_UP,
            amount: topUp.amount,
            balanceAfter: user.walletBalance,
            note: `KHQR top-up ${topUp.billNumber}`
          }
        });
      });
    } else if (topUp.expiresAt <= new Date()) {
      await prisma.walletTopUp.updateMany({
        where: { id: topUp.id, userId, status: WalletTopUpStatus.PENDING },
        data: { status: WalletTopUpStatus.EXPIRED }
      });
    }
  } else if (topUp.status === WalletTopUpStatus.PENDING && topUp.expiresAt <= new Date()) {
    await prisma.walletTopUp.updateMany({
      where: { id: topUp.id, userId, status: WalletTopUpStatus.PENDING },
      data: { status: WalletTopUpStatus.EXPIRED }
    });
  }

  const [updated, user] = await Promise.all([
    prisma.walletTopUp.findUniqueOrThrow({ where: { id: topUp.id }, select: { status: true, expiresAt: true } }),
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { walletBalance: true } })
  ]);
  return { status: updated.status, balance: user.walletBalance.toString(), expiresAt: updated.expiresAt };
}
