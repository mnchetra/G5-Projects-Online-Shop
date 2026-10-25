import type { Request, Response } from 'express';
import { OrderStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { checkout } from '../services/order.service.js';
import { HttpError, success } from '../utils/http.js';
import { assertBakongConfigured, checkBakongKhqr, createBakongKhqr } from '../services/payment.service.js';
import { lockEscrowFunds } from '../services/escrow.service.js';

type KhqrOrder = Pick<Awaited<ReturnType<typeof checkout>>, 'id' | 'orderNumber' | 'total' | 'paymentMethod' | 'payment' | 'escrow'>;

export async function createOrder(req: Request, res: Response) {
  if (req.body.paymentMethod === 'ABA_KHQR' || req.body.paymentMethod === 'BAKONG_ESCROW') {
    assertBakongConfigured();
  }
  const order = await checkout(req.body, req.auth?.userId);
  if (order.paymentMethod === 'CASH_ON_DELIVERY') {
    res.status(201).json(success({ order, khqr: null }));
    return;
  }

  try {
    const khqr = await createQrForOrder(order);
    res.status(201).json(success({ order, khqr, paymentError: null }));
  } catch (error) {
    const paymentError = error instanceof HttpError ? error.message : 'Could not create the Bakong payment QR';
    res.status(201).json(success({ order, khqr: null, paymentError }));
  }
}

async function findGuestKhqrOrder(orderNumber: string, customerPhone: string): Promise<KhqrOrder> {
  const order = await prisma.order.findFirst({
    where: { orderNumber, customerPhone },
    include: { payment: true, escrow: true }
  });
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.paymentMethod === 'CASH_ON_DELIVERY' || !order.payment) {
    throw new HttpError(409, 'This order does not use Bakong KHQR');
  }
  return order;
}

async function createQrForOrder(order: KhqrOrder) {
  if (!order.payment) throw new HttpError(404, 'Payment record not found');
  if (order.payment.status === 'PAID') throw new HttpError(409, 'This payment is already complete');
  if (order.payment.qrImage && order.payment.qrString && order.payment.providerRef) {
    return { qr: order.payment.qrString, md5: order.payment.providerRef, qrImage: order.payment.qrImage };
  }
  const qr = await createBakongKhqr({ orderNumber: order.orderNumber, amount: Number(order.total) });
  await prisma.payment.update({
    where: { orderId: order.id },
    data: { provider: 'Bakong KHQR', providerRef: qr.md5, qrString: qr.qr, qrImage: qr.qrImage }
  });
  return qr;
}

export async function retryOrderKhqr(req: Request, res: Response) {
  const order = await findGuestKhqrOrder(req.params.orderNumber, req.body.customerPhone);
  const khqr = await createQrForOrder(order);
  res.json(success({ khqr }));
}

export async function checkOrderKhqrStatus(req: Request, res: Response) {
  const order = await findGuestKhqrOrder(req.params.orderNumber, req.body.customerPhone);
  if (!order.payment) throw new HttpError(404, 'Payment record not found');
  if (order.payment.status === 'PAID') {
    res.json(success({ status: 'PAID', confirmed: true, escrow: order.escrow }));
    return;
  }
  if (!order.payment.providerRef) {
    res.json(success({ status: 'PENDING', confirmed: false, escrow: order.escrow }));
    return;
  }

  const result = await checkBakongKhqr(order.payment.providerRef);
  if (result.paid) {
    await prisma.payment.update({ where: { id: order.payment.id }, data: { status: 'PAID' } });

    let updatedEscrow = order.escrow;
    if (order.paymentMethod === 'BAKONG_ESCROW') {
      updatedEscrow = await lockEscrowFunds({
        orderNumber: order.orderNumber,
        bakongMd5: order.payment.providerRef
      });
    }

    res.json(success({ status: 'PAID', confirmed: true, escrow: updatedEscrow }));
    return;
  }
  res.json(success({ status: 'PENDING', confirmed: false, escrow: order.escrow }));
}

export async function listOrders(req: Request, res: Response) {
  const orders = await prisma.order.findMany({
    where: { userId: req.auth!.userId },
    include: { items: true, payment: true, escrow: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(success(orders));
}

export async function getOrder(req: Request, res: Response) {
  const order = await prisma.order.findFirst({
    where: { orderNumber: req.params.orderNumber, userId: req.auth!.userId },
    include: { items: true, payment: true, escrow: true }
  });
  if (!order) throw new HttpError(404, 'Order not found');
  res.json(success(order));
}

export async function updateOrderStatus(req: Request, res: Response) {
  const status = req.body.status as OrderStatus;
  const order = await prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: req.params.id }, include: { items: true } });
    if (!current) throw new HttpError(404, 'Order not found');
    if (current.status === OrderStatus.CANCELLED && status !== OrderStatus.CANCELLED) {
      throw new HttpError(409, 'Cancelled orders cannot be reopened');
    }
    if (status === OrderStatus.CANCELLED && current.status !== OrderStatus.CANCELLED) {
      for (const item of current.items) {
        if (item.productId) await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
      }
      await tx.payment.updateMany({ where: { orderId: current.id, status: 'PENDING' }, data: { status: 'FAILED' } });
    }
    return tx.order.update({ where: { id: current.id }, data: { status }, include: { items: true, payment: true, escrow: true } });
  });
  res.json(success(order));
}