import { EscrowStatus, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http.js';

export async function lockEscrowFunds(params: {
  orderNumber: string;
  bakongMd5: string;
  bakongAccountId?: string;
}) {
  const order = await prisma.order.findUnique({
    where: { orderNumber: params.orderNumber },
    include: { escrow: true, payment: true }
  });

  if (!order) throw new HttpError(404, 'Order not found');

  const updatedEscrow = await prisma.escrowRecord.update({
    where: { orderId: order.id },
    data: {
      status: EscrowStatus.FUNDS_LOCKED,
      bakongMd5: params.bakongMd5,
      bakongAccountId: params.bakongAccountId || process.env.BAKONG_ACCOUNT_ID,
      lockedAt: new Date(),
      txHash: null
    }
  });

  // Make sure order payment is marked PAID
  if (order.payment && order.payment.status !== PaymentStatus.PAID) {
    await prisma.payment.update({
      where: { id: order.payment.id },
      data: { status: PaymentStatus.PAID, providerRef: params.bakongMd5 }
    });
  }

  // Update order status to CONFIRMED
  if (order.status === OrderStatus.PENDING) {
    await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CONFIRMED }
    });
  }

  return updatedEscrow;
}

export async function markEscrowDispatched(orderNumber: string, customInspectionDays = 3) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { escrow: true }
  });

  if (!order || !order.escrow) throw new HttpError(404, 'Escrow record not found for this order');
  if (order.escrow.status !== EscrowStatus.FUNDS_LOCKED) {
    throw new HttpError(409, `Cannot dispatch order with escrow in ${order.escrow.status} state`);
  }

  const days = Math.max(1, Math.min(14, customInspectionDays));
  const autoReleaseAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

  const [escrow] = await prisma.$transaction([
    prisma.escrowRecord.update({
      where: { id: order.escrow.id },
      data: {
        status: EscrowStatus.DISPATCHED,
        dispatchedAt: new Date(),
        inspectionDays: days,
        autoReleaseAt
      }
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.SHIPPED }
    })
  ]);

  return escrow;
}

export async function releaseEscrowFunds(orderNumber: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { escrow: true, payment: true }
  });

  if (!order || !order.escrow) throw new HttpError(404, 'Escrow agreement not found');
  if (order.userId !== userId) throw new HttpError(403, 'Only the customer who placed this order can confirm delivery');

  if (order.escrow.status !== EscrowStatus.FUNDS_LOCKED && order.escrow.status !== EscrowStatus.DISPATCHED) {
    throw new HttpError(409, `Cannot release funds when escrow is in ${order.escrow.status} state`);
  }

  const isDemoWallet = order.paymentMethod === 'DEMO_WALLET';
  const releaseTxHash = null;
  const escrow = await prisma.$transaction(async (tx) => {
    const transitioned = await tx.escrowRecord.updateMany({
      where: { id: order.escrow!.id, status: { in: [EscrowStatus.FUNDS_LOCKED, EscrowStatus.DISPATCHED] } },
      data: {
        status: EscrowStatus.RELEASED,
        releaseTxHash,
        releasedAt: new Date()
      }
    });
    if (transitioned.count !== 1) throw new HttpError(409, 'Escrow status changed before delivery could be confirmed');
    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.DELIVERED } });
    if (isDemoWallet && order.userId) {
      const customer = await tx.user.findUniqueOrThrow({ where: { id: order.userId }, select: { walletBalance: true } });
      await tx.walletTransaction.create({
        data: {
          userId: order.userId,
          actorUserId: userId,
          orderId: order.id,
          type: 'ORDER_RELEASE',
          amount: order.total,
          balanceAfter: customer.walletBalance,
          note: `Demo wallet hold released to store for order ${orderNumber}; no real payout`
        }
      });
    }
    return tx.escrowRecord.findUniqueOrThrow({ where: { id: order.escrow!.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { escrow, releaseTxHash };
}

export async function disputeEscrow(orderNumber: string, reason: string, userId: string) {
  if (!reason || reason.trim().length < 5) {
    throw new HttpError(400, 'Please provide a detailed dispute reason (minimum 5 characters)');
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { escrow: true }
  });

  if (!order || !order.escrow) throw new HttpError(404, 'Escrow agreement not found');
  if (order.userId !== userId) throw new HttpError(403, 'Only the customer who placed this order can file a dispute');

  if (order.escrow.status !== EscrowStatus.FUNDS_LOCKED && order.escrow.status !== EscrowStatus.DISPATCHED) {
    throw new HttpError(409, `Dispute cannot be filed while escrow is in ${order.escrow.status} state`);
  }

  const updated = await prisma.escrowRecord.updateMany({
    where: { id: order.escrow.id, status: { in: [EscrowStatus.FUNDS_LOCKED, EscrowStatus.DISPATCHED] } },
    data: {
      status: EscrowStatus.DISPUTED,
      disputeReason: reason.trim()
    }
  });
  if (updated.count !== 1) throw new HttpError(409, 'Escrow status changed before the dispute could be filed');
  return prisma.escrowRecord.findUniqueOrThrow({ where: { id: order.escrow.id } });
}

export async function resolveEscrowDispute(
  orderNumber: string,
  resolution: 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER',
  resolutionNotes: string,
  actorUserId: string
) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { escrow: true, payment: true, items: true }
  });

  if (!order || !order.escrow) throw new HttpError(404, 'Escrow agreement not found');
  if (order.escrow.status !== EscrowStatus.DISPUTED) {
    throw new HttpError(409, 'Only disputed escrows can be arbitrated');
  }
  const escrowId = order.escrow.id;
  const disputeReason = order.escrow.disputeReason;

  if (resolution === 'RELEASE_TO_SELLER') {
    const releaseTxHash = null;
    const escrow = await prisma.$transaction(async (tx) => {
      const transitioned = await tx.escrowRecord.updateMany({
        where: { id: escrowId, status: EscrowStatus.DISPUTED },
        data: {
          status: EscrowStatus.RELEASED,
          releaseTxHash,
          releasedAt: new Date(),
          disputeReason: `${disputeReason || ''}\n[Arbitration Note]: ${resolutionNotes}`.trim()
        }
      });
      if (transitioned.count !== 1) throw new HttpError(409, 'Escrow is no longer disputed');
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.DELIVERED } });
      if (order.paymentMethod === 'DEMO_WALLET' && order.userId) {
        const customer = await tx.user.findUniqueOrThrow({ where: { id: order.userId }, select: { walletBalance: true } });
        await tx.walletTransaction.create({
          data: {
            userId: order.userId,
            actorUserId,
            orderId: order.id,
            type: 'ORDER_RELEASE',
            amount: order.total,
            balanceAfter: customer.walletBalance,
            note: `Demo wallet hold released to store after dispute resolution for order ${orderNumber}; no real payout`
          }
        });
      }
      return tx.escrowRecord.findUniqueOrThrow({ where: { id: escrowId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { escrow, resolution: 'RELEASE_TO_SELLER' };
  }

  // REFUND_TO_BUYER
  const refundTxHash = null;
  const escrow = await prisma.$transaction(async (tx) => {
    const transitioned = await tx.escrowRecord.updateMany({
      where: { id: escrowId, status: EscrowStatus.DISPUTED },
      data: {
        status: EscrowStatus.REFUNDED,
        refundTxHash,
        refundedAt: new Date(),
        disputeReason: `${disputeReason || ''}\n[Refund Granted]: ${resolutionNotes}`.trim()
      }
    });
    if (transitioned.count !== 1) throw new HttpError(409, 'Escrow is no longer disputed');
    await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
    await tx.payment.updateMany({ where: { orderId: order.id }, data: { status: PaymentStatus.REFUNDED } });
    for (const item of order.items) {
      if (item.productId) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
    }
    if (order.paymentMethod === 'DEMO_WALLET') {
      if (!order.userId) throw new HttpError(409, 'Cannot refund a demo wallet order without its customer account');
      const customer = await tx.user.update({
        where: { id: order.userId },
        data: { walletBalance: { increment: order.total } },
        select: { walletBalance: true }
      });
      await tx.walletTransaction.create({
        data: {
          userId: order.userId,
          actorUserId,
          orderId: order.id,
          type: 'ORDER_REFUND',
          amount: order.total,
          balanceAfter: customer.walletBalance,
          note: `Demo wallet refund for order ${orderNumber}: ${resolutionNotes}`
        }
      });
    }
    return tx.escrowRecord.findUniqueOrThrow({ where: { id: escrowId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { escrow, resolution: 'REFUND_TO_BUYER' };
}

export async function getEscrowDetails(orderNumber: string, userId: string, userRole?: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      escrow: true,
      payment: true,
      items: true
    }
  });

  if (!order) throw new HttpError(404, 'Order not found');
  if (order.userId !== userId && userRole !== 'ADMIN') throw new HttpError(403, 'You can only view escrow details for your own orders');

  return {
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    orderStatus: order.status,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.payment?.status,
    qrImage: order.payment?.qrImage,
    qrString: order.payment?.qrString,
    bakongRef: order.payment?.providerRef,
    escrow: order.escrow,
    items: order.items,
    createdAt: order.createdAt
  };
}

export async function listAdminEscrows(filter?: { status?: EscrowStatus; search?: string }) {
  const where: Prisma.EscrowRecordWhereInput = {};

  if (filter?.status) {
    where.status = filter.status;
  }

  if (filter?.search) {
    const s = filter.search.trim();
    where.OR = [
      { order: { orderNumber: { contains: s } } },
      { order: { customerName: { contains: s } } },
      { order: { customerPhone: { contains: s } } },
      { bakongMd5: { contains: s } },
      { txHash: { contains: s } }
    ];
  }

  const [escrows, totalCount, statusCounts] = await Promise.all([
    prisma.escrowRecord.findMany({
      where,
      include: {
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            total: true,
            paymentMethod: true,
            status: true,
            createdAt: true,
            items: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }),
    prisma.escrowRecord.count({ where }),
    prisma.escrowRecord.groupBy({
      by: ['status'],
      _count: { status: true }
    })
  ]);

  const stats = {
    total: totalCount,
    initiated: 0,
    fundsLocked: 0,
    dispatched: 0,
    released: 0,
    disputed: 0,
    refunded: 0
  };

  for (const group of statusCounts) {
    if (group.status === EscrowStatus.INITIATED) stats.initiated = group._count.status;
    else if (group.status === EscrowStatus.FUNDS_LOCKED) stats.fundsLocked = group._count.status;
    else if (group.status === EscrowStatus.DISPATCHED) stats.dispatched = group._count.status;
    else if (group.status === EscrowStatus.RELEASED) stats.released = group._count.status;
    else if (group.status === EscrowStatus.DISPUTED) stats.disputed = group._count.status;
    else if (group.status === EscrowStatus.REFUNDED) stats.refunded = group._count.status;
  }

  return { escrows, stats };
}
