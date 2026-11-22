import { EscrowStatus, OrderStatus, PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileTypeFromBuffer } from 'file-type';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http.js';

const allowedEvidenceTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime'
]);

const escrowEvidenceInclude = {
  evidence: {
    orderBy: { createdAt: 'asc' as const },
    include: { uploader: { select: { id: true, name: true, role: true } } }
  }
} satisfies Prisma.EscrowRecordInclude;

type PreparedEvidence = {
  escrowId: string;
  uploaderUserId: string;
  stage: 'CUSTOMER' | 'ADMIN' | 'SUPER_ADMIN';
  filename: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
};

function escrowEvidenceDirectory() {
  return path.resolve(process.env.ESCROW_EVIDENCE_DIRECTORY || path.join(process.cwd(), 'private_uploads', 'escrow-evidence'));
}

async function removePreparedEvidence(files: PreparedEvidence[]) {
  await Promise.all(files.map(async (file) => {
    try {
      await unlink(path.join(escrowEvidenceDirectory(), file.filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        console.error('Failed to remove staged escrow evidence file:', error);
      }
    }
  }));
}

async function prepareEvidence(
  files: Express.Multer.File[],
  escrowId: string,
  uploaderUserId: string,
  stage: PreparedEvidence['stage']
) {
  const prepared: PreparedEvidence[] = [];
  if (!files.length) return prepared;

  const directory = escrowEvidenceDirectory();
  await mkdir(directory, { recursive: true });

  try {
    for (const file of files) {
      const detected = await fileTypeFromBuffer(file.buffer);
      if (!detected || !allowedEvidenceTypes.has(detected.mime) || detected.mime !== file.mimetype) {
        throw new HttpError(400, 'Evidence file content does not match an allowed image or video type');
      }
      const originalName = path.basename(file.originalname).replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 255) || 'evidence';
      const filename = `${randomUUID()}.${detected.ext}`;
      await writeFile(path.join(directory, filename), file.buffer, { flag: 'wx' });
      prepared.push({
        escrowId,
        uploaderUserId,
        stage,
        filename,
        originalName,
        mimeType: detected.mime,
        fileSize: file.size
      });
    }
  } catch (error) {
    await removePreparedEvidence(prepared);
    throw error;
  }

  return prepared;
}

async function createEvidenceRecords(tx: Prisma.TransactionClient, files: PreparedEvidence[]) {
  if (files.length) await tx.escrowEvidence.createMany({ data: files });
}

async function withPreparedEvidence<T>(
  files: Express.Multer.File[],
  escrowId: string,
  uploaderUserId: string,
  stage: PreparedEvidence['stage'],
  save: (prepared: PreparedEvidence[]) => Promise<T>
) {
  const prepared = await prepareEvidence(files, escrowId, uploaderUserId, stage);
  try {
    return await save(prepared);
  } catch (error) {
    await removePreparedEvidence(prepared);
    throw error;
  }
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
          note: `Store wallet order hold released for ${orderNumber}; no separate payout`
        }
      });
    }
    return tx.escrowRecord.findUniqueOrThrow({ where: { id: order.escrow!.id } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return { escrow, releaseTxHash };
}

export async function disputeEscrow(orderNumber: string, reason: string, userId: string, files: Express.Multer.File[] = []) {
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

  return withPreparedEvidence(files, order.escrow.id, userId, 'CUSTOMER', async (prepared) => prisma.$transaction(async (tx) => {
    const updated = await tx.escrowRecord.updateMany({
      where: { id: order.escrow!.id, status: { in: [EscrowStatus.FUNDS_LOCKED, EscrowStatus.DISPATCHED] } },
      data: {
        status: EscrowStatus.DISPUTED,
        disputeReason: reason.trim()
      }
    });
    if (updated.count !== 1) throw new HttpError(409, 'Escrow status changed before the dispute could be filed');
    await createEvidenceRecords(tx, prepared);
    return tx.escrowRecord.findUniqueOrThrow({ where: { id: order.escrow!.id }, include: escrowEvidenceInclude });
  }));
}

export async function respondToEscrowDispute(orderNumber: string, response: string, actorUserId: string, files: Express.Multer.File[] = []) {
  const trimmedResponse = response.trim();
  if (trimmedResponse.length < 5) throw new HttpError(400, 'Please provide a detailed response (minimum 5 characters)');

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { escrow: true }
  });
  if (!order || !order.escrow) throw new HttpError(404, 'Escrow agreement not found');
  if (order.escrow.status !== EscrowStatus.DISPUTED) throw new HttpError(409, 'Only disputed escrows can receive an administrator response');

  return withPreparedEvidence(files, order.escrow.id, actorUserId, 'ADMIN', async (prepared) => prisma.$transaction(async (tx) => {
    const updated = await tx.escrowRecord.updateMany({
      where: { id: order.escrow!.id, status: EscrowStatus.DISPUTED },
      data: {
        adminResponse: trimmedResponse,
        adminRespondedAt: new Date(),
        adminRespondedByUserId: actorUserId
      }
    });
    if (updated.count !== 1) throw new HttpError(409, 'Escrow status changed before the response could be recorded');
    await createEvidenceRecords(tx, prepared);
    return tx.escrowRecord.findUniqueOrThrow({ where: { id: order.escrow!.id }, include: escrowEvidenceInclude });
  }));
}

export async function resolveEscrowDispute(
  orderNumber: string,
  resolution: 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER',
  resolutionNotes: string,
  actorUserId: string,
  restockItems = false,
  files: Express.Multer.File[] = []
) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { escrow: true, payment: true, items: true }
  });

  if (!order || !order.escrow) throw new HttpError(404, 'Escrow agreement not found');
  if (order.escrow.status !== EscrowStatus.DISPUTED) {
    throw new HttpError(409, 'Only disputed escrows can be arbitrated');
  }
  if (!order.escrow.adminResponse) {
    throw new HttpError(409, 'The administrator must respond before Super Admin arbitration');
  }
  const escrowId = order.escrow.id;

  return withPreparedEvidence(files, escrowId, actorUserId, 'SUPER_ADMIN', async (prepared) => {
    if (resolution === 'RELEASE_TO_SELLER') {
      const releaseTxHash = null;
      const escrow = await prisma.$transaction(async (tx) => {
        const transitioned = await tx.escrowRecord.updateMany({
          where: { id: escrowId, status: EscrowStatus.DISPUTED },
          data: {
            status: EscrowStatus.RELEASED,
            releaseTxHash,
            releasedAt: new Date(),
            resolutionNotes: resolutionNotes.trim(),
            arbitratedAt: new Date(),
            arbitratedByUserId: actorUserId,
            inventoryRestocked: false
          }
        });
        if (transitioned.count !== 1) throw new HttpError(409, 'Escrow is no longer disputed');
        await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.DELIVERED } });
        await createEvidenceRecords(tx, prepared);
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
              note: `Store wallet order hold released after dispute resolution for ${orderNumber}; no separate payout`
            }
          });
        }
        return tx.escrowRecord.findUniqueOrThrow({ where: { id: escrowId }, include: escrowEvidenceInclude });
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
          resolutionNotes: resolutionNotes.trim(),
          arbitratedAt: new Date(),
          arbitratedByUserId: actorUserId,
          inventoryRestocked: restockItems
        }
      });
      if (transitioned.count !== 1) throw new HttpError(409, 'Escrow is no longer disputed');
      await tx.order.update({ where: { id: order.id }, data: { status: OrderStatus.CANCELLED } });
      await tx.payment.updateMany({ where: { orderId: order.id }, data: { status: PaymentStatus.REFUNDED } });
      await createEvidenceRecords(tx, prepared);
      if (restockItems) {
        for (const item of order.items) {
          if (item.productId) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }
      }
      if (order.paymentMethod === 'DEMO_WALLET') {
        if (!order.userId) throw new HttpError(409, 'Cannot refund a wallet order without its customer account');
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
            note: `Store wallet refund for order ${orderNumber}: ${resolutionNotes}`
          }
        });
      }
      return tx.escrowRecord.findUniqueOrThrow({ where: { id: escrowId }, include: escrowEvidenceInclude });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return { escrow, resolution: 'REFUND_TO_BUYER' };
  });
}

export async function getEscrowDetails(orderNumber: string, userId: string, userRole?: string) {
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      escrow: {
        include: {
          adminRespondedBy: { select: { name: true, email: true } },
          arbitratedBy: { select: { name: true, email: true } },
          ...escrowEvidenceInclude
        }
      },
      payment: true,
      items: true
    }
  });

  if (!order) throw new HttpError(404, 'Order not found');
  if (order.userId !== userId && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') throw new HttpError(403, 'You can only view escrow details for your own orders');

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

export async function getEscrowEvidenceFile(
  orderNumber: string,
  evidenceId: string,
  userId: string,
  userRole?: string
) {
  const evidence = await prisma.escrowEvidence.findFirst({
    where: { id: evidenceId, escrow: { order: { orderNumber } } },
    include: { escrow: { select: { order: { select: { userId: true } } } } }
  });
  if (!evidence) throw new HttpError(404, 'Evidence file not found');
  if (evidence.escrow.order.userId !== userId && userRole !== 'ADMIN' && userRole !== 'SUPER_ADMIN') {
    throw new HttpError(403, 'You can only view evidence for your own orders');
  }

  return {
    path: path.join(escrowEvidenceDirectory(), evidence.filename),
    mimeType: evidence.mimeType,
    fileSize: evidence.fileSize
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
        adminRespondedBy: { select: { name: true, email: true } },
        arbitratedBy: { select: { name: true, email: true } },
        ...escrowEvidenceInclude,
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
