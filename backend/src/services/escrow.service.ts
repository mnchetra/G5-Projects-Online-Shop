import crypto from 'node:crypto';
import { EscrowStatus, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http.js';

export const ESCROW_CONTRACT_METADATA = {
  contractName: 'BakongEscrow',
  contractAddress: '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7',
  contractNetwork: 'Bakong EVM L2 Testnet',
  chainId: 855,
  compilerVersion: 'v0.8.20+commit.a1b79de6',
  arbiterAddress: '0x12E9f7c00e668D8Fa3e93B474a001a1f0a2c9431',
  sellerDefaultAddress: '0x34A7B8233eD0c40e11894a4D2aA21D124806a771',
  explorerBaseUrl: 'https://explorer.bakong.org.kh/tx/'
};

export function generateEvmTxHash(prefix: string, seed: string): string {
  const hash = crypto.createHash('sha256').update(`${prefix}-${seed}-${Date.now()}-${Math.random()}`).digest('hex');
  return `0x${hash}`;
}

export function generateWalletAddress(seed: string): string {
  const hash = crypto.createHash('sha256').update(seed).digest('hex');
  return `0x${hash.slice(0, 40)}`;
}

export async function initiateEscrow(params: {
  orderId: string;
  orderNumber: string;
  amount: number | Prisma.Decimal;
  customerPhone: string;
  buyerAddress?: string;
  sellerAddress?: string;
}) {
  const buyerAddress = params.buyerAddress || generateWalletAddress(`buyer-${params.customerPhone}`);
  const sellerAddress = params.sellerAddress || ESCROW_CONTRACT_METADATA.sellerDefaultAddress;
  const arbiterAddress = ESCROW_CONTRACT_METADATA.arbiterAddress;

  const creationTxHash = generateEvmTxHash('escrow-create', params.orderNumber);

  return prisma.escrowRecord.upsert({
    where: { orderId: params.orderId },
    update: {
      amount: new Prisma.Decimal(params.amount),
      buyerAddress,
      sellerAddress,
      arbiterAddress,
      txHash: creationTxHash
    },
    create: {
      orderId: params.orderId,
      contractAddress: ESCROW_CONTRACT_METADATA.contractAddress,
      contractNetwork: ESCROW_CONTRACT_METADATA.contractNetwork,
      txHash: creationTxHash,
      buyerAddress,
      sellerAddress,
      arbiterAddress,
      amount: new Prisma.Decimal(params.amount),
      status: EscrowStatus.INITIATED,
      inspectionDays: 3
    }
  });
}

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

  const lockTxHash = generateEvmTxHash('escrow-lock', `${params.orderNumber}-${params.bakongMd5}`);

  const updatedEscrow = await prisma.escrowRecord.update({
    where: { orderId: order.id },
    data: {
      status: EscrowStatus.FUNDS_LOCKED,
      bakongMd5: params.bakongMd5,
      bakongAccountId: params.bakongAccountId || process.env.BAKONG_ACCOUNT_ID,
      lockedAt: new Date(),
      txHash: order.escrow?.txHash || lockTxHash
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

export async function releaseEscrowFunds(orderNumber: string, customerPhone?: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { escrow: true, payment: true }
  });

  if (!order || !order.escrow) throw new HttpError(404, 'Escrow agreement not found');

  if (customerPhone && order.customerPhone !== customerPhone) {
    throw new HttpError(403, 'Phone number does not match order record');
  }

  if (order.escrow.status !== EscrowStatus.FUNDS_LOCKED && order.escrow.status !== EscrowStatus.DISPATCHED) {
    throw new HttpError(409, `Cannot release funds when escrow is in ${order.escrow.status} state`);
  }

  const releaseTxHash = generateEvmTxHash('escrow-release', orderNumber);

  const [escrow] = await prisma.$transaction([
    prisma.escrowRecord.update({
      where: { id: order.escrow.id },
      data: {
        status: EscrowStatus.RELEASED,
        releaseTxHash,
        releasedAt: new Date()
      }
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.DELIVERED }
    })
  ]);

  return { escrow, releaseTxHash };
}

export async function disputeEscrow(orderNumber: string, reason: string, customerPhone?: string) {
  if (!reason || reason.trim().length < 5) {
    throw new HttpError(400, 'Please provide a detailed dispute reason (minimum 5 characters)');
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { escrow: true }
  });

  if (!order || !order.escrow) throw new HttpError(404, 'Escrow agreement not found');

  if (customerPhone && order.customerPhone !== customerPhone) {
    throw new HttpError(403, 'Phone number does not match order record');
  }

  if (order.escrow.status !== EscrowStatus.FUNDS_LOCKED && order.escrow.status !== EscrowStatus.DISPATCHED) {
    throw new HttpError(409, `Dispute cannot be filed while escrow is in ${order.escrow.status} state`);
  }

  return prisma.escrowRecord.update({
    where: { id: order.escrow.id },
    data: {
      status: EscrowStatus.DISPUTED,
      disputeReason: reason.trim()
    }
  });
}

export async function resolveEscrowDispute(
  orderNumber: string,
  resolution: 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER',
  resolutionNotes: string
) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { escrow: true, payment: true, items: true }
  });

  if (!order || !order.escrow) throw new HttpError(404, 'Escrow agreement not found');
  if (order.escrow.status !== EscrowStatus.DISPUTED) {
    throw new HttpError(409, 'Only disputed escrows can be arbitrated');
  }

  if (resolution === 'RELEASE_TO_SELLER') {
    const releaseTxHash = generateEvmTxHash('arbiter-release', orderNumber);
    const [escrow] = await prisma.$transaction([
      prisma.escrowRecord.update({
        where: { id: order.escrow.id },
        data: {
          status: EscrowStatus.RELEASED,
          releaseTxHash,
          releasedAt: new Date(),
          disputeReason: `${order.escrow.disputeReason || ''}\n[Arbitration Note]: ${resolutionNotes}`.trim()
        }
      }),
      prisma.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.DELIVERED }
      })
    ]);
    return { escrow, resolution: 'RELEASE_TO_SELLER' };
  }

  // REFUND_TO_BUYER
  const refundTxHash = generateEvmTxHash('arbiter-refund', orderNumber);
  const [escrow] = await prisma.$transaction([
    prisma.escrowRecord.update({
      where: { id: order.escrow.id },
      data: {
        status: EscrowStatus.REFUNDED,
        refundTxHash,
        refundedAt: new Date(),
        disputeReason: `${order.escrow.disputeReason || ''}\n[Refund Granted]: ${resolutionNotes}`.trim()
      }
    }),
    prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED }
    }),
    prisma.payment.updateMany({
      where: { orderId: order.id },
      data: { status: PaymentStatus.REFUNDED }
    }),
    // Restock items
    ...order.items.map((item) =>
      item.productId
        ? prisma.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } })
        : prisma.$executeRaw`SELECT 1`
    )
  ]);

  return { escrow, resolution: 'REFUND_TO_BUYER' };
}

export async function getEscrowDetails(orderNumber: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      escrow: true,
      payment: true,
      items: true
    }
  });

  if (!order) throw new HttpError(404, 'Order not found');

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
    contract: ESCROW_CONTRACT_METADATA,
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
