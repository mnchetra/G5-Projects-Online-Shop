import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { checkout } from './order.service.js';
import { disputeEscrow, markEscrowDispatched, releaseEscrowFunds, respondToEscrowDispute, resolveEscrowDispute } from './escrow.service.js';

describe('Store wallet order flow', () => {
  const createdOrderIds: string[] = [];
  const users: string[] = [];
  const restockedOrderIds = new Set<string>();

  afterAll(async () => {
    for (const orderId of createdOrderIds) {
      const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
      if (!order) continue;
      if (!restockedOrderIds.has(orderId)) {
        for (const item of order.items) {
          if (item.productId) await prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }
      }
      await prisma.order.delete({ where: { id: orderId } });
    }
    if (users.length) await prisma.user.deleteMany({ where: { id: { in: users } } });
  });

  it('holds wallet balance at checkout, releases on buyer confirmation, refunds a dispute, and rejects insufficient funds', async () => {
    const product = await prisma.product.findFirst({ where: { isActive: true, stock: { gt: 0 } } });
    expect(product).toBeDefined();
    const buyer = await prisma.user.create({
      data: {
        email: `wallet-buyer-${randomUUID()}@example.test`,
        name: 'Wallet Flow Test',
        passwordHash: 'test-only',
        walletBalance: '5000.00'
      }
    });
    users.push(buyer.id);
    const admin = await prisma.user.create({
      data: { email: `wallet-admin-${randomUUID()}@example.test`, name: 'Wallet Test Admin', passwordHash: 'test-only', role: 'ADMIN' }
    });
    users.push(admin.id);
    const superAdmin = await prisma.user.create({
      data: { email: `wallet-superadmin-${randomUUID()}@example.test`, name: 'Wallet Test Super Admin', passwordHash: 'test-only', role: 'SUPER_ADMIN' }
    });
    users.push(superAdmin.id);

    const firstOrder = await checkout({
      customerName: buyer.name,
      customerEmail: buyer.email,
      customerPhone: '012345678',
      addressLine: '12 Test Street',
      city: 'Phnom Penh',
      province: 'Phnom Penh',
      paymentMethod: 'DEMO_WALLET',
      items: [{ productId: product!.id, quantity: 1 }]
    }, buyer.id);
    createdOrderIds.push(firstOrder.id);
    expect(firstOrder.payment?.status).toBe('PAID');
    expect(firstOrder.escrow?.status).toBe('FUNDS_LOCKED');

    const balanceAfterHold = await prisma.user.findUniqueOrThrow({ where: { id: buyer.id }, select: { walletBalance: true } });
    expect(Number(balanceAfterHold.walletBalance)).toBeCloseTo(5000 - Number(firstOrder.total), 2);

    await markEscrowDispatched(firstOrder.orderNumber);
    const released = await releaseEscrowFunds(firstOrder.orderNumber, buyer.id);
    expect(released.escrow.status).toBe('RELEASED');
    expect(released.releaseTxHash).toBeNull();
    expect(await prisma.walletTransaction.count({ where: { orderId: firstOrder.id, type: 'ORDER_RELEASE' } })).toBe(1);

    const secondOrder = await checkout({
      customerName: buyer.name,
      customerPhone: '012345678',
      addressLine: '12 Test Street',
      city: 'Phnom Penh',
      province: 'Phnom Penh',
      paymentMethod: 'DEMO_WALLET',
      items: [{ productId: product!.id, quantity: 1 }]
    }, buyer.id);
    createdOrderIds.push(secondOrder.id);
    await disputeEscrow(secondOrder.orderNumber, 'Test dispute for wallet refund', buyer.id);
    await respondToEscrowDispute(secondOrder.orderNumber, 'Store response for the test dispute.', admin.id);
    const refund = await resolveEscrowDispute(secondOrder.orderNumber, 'REFUND_TO_BUYER', 'Test refund approved by Super Admin', superAdmin.id, true);
    restockedOrderIds.add(secondOrder.id);
    expect(refund.escrow.status).toBe('REFUNDED');
    expect(refund.escrow.refundTxHash).toBeNull();
    expect(refund.escrow.inventoryRestocked).toBe(true);

    const balanceAfterRefund = await prisma.user.findUniqueOrThrow({ where: { id: buyer.id }, select: { walletBalance: true } });
    expect(Number(balanceAfterRefund.walletBalance)).toBeCloseTo(Number(balanceAfterHold.walletBalance), 2);
    expect(await prisma.walletTransaction.count({ where: { orderId: secondOrder.id, type: 'ORDER_REFUND' } })).toBe(1);

    const emptyBuyer = await prisma.user.create({
      data: {
        email: `wallet-empty-${randomUUID()}@example.test`,
        name: 'Empty Wallet Test',
        passwordHash: 'test-only',
        walletBalance: '0.00'
      }
    });
    users.push(emptyBuyer.id);
    const stockBefore = await prisma.product.findUniqueOrThrow({ where: { id: product!.id }, select: { stock: true } });
    await expect(checkout({
      customerName: emptyBuyer.name,
      customerPhone: '012345679',
      addressLine: '13 Test Street',
      city: 'Phnom Penh',
      province: 'Phnom Penh',
      paymentMethod: 'DEMO_WALLET',
      items: [{ productId: product!.id, quantity: 1 }]
    }, emptyBuyer.id)).rejects.toThrow('Insufficient wallet balance');
    const stockAfter = await prisma.product.findUniqueOrThrow({ where: { id: product!.id }, select: { stock: true } });
    expect(stockAfter.stock).toBe(stockBefore.stock);
  });
});
