import { OrderStatus, PaymentMethod, PaymentStatus, Prisma, WalletTransactionType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http.js';

type CheckoutInput = {
  customerName: string;
  customerEmail?: string;
  customerPhone: string;
  addressLine: string;
  city: string;
  province: string;
  notes?: string;
  paymentMethod: PaymentMethod;
  items: { productId: string; quantity: number }[];
};

export async function checkout(input: CheckoutInput, userId?: string) {
  return prisma.$transaction(async (tx) => {
    const productIds = [...new Set(input.items.map((item) => item.productId))];
    const products = await tx.product.findMany({ where: { OR: [{ id: { in: productIds } }, { slug: { in: productIds } }], isActive: true } });
    const productById = new Map(products.flatMap((product) => [[product.id, product], [product.slug, product]]));
    if (productIds.some((productId) => !productById.has(productId))) throw new HttpError(400, 'One or more products are unavailable');
    let subtotal = new Prisma.Decimal(0);
    const orderItems = [];
    for (const requested of input.items) {
      const product = productById.get(requested.productId)!;
      const updated = await tx.product.updateMany({ where: { id: product.id, stock: { gte: requested.quantity }, isActive: true }, data: { stock: { decrement: requested.quantity } } });
      if (updated.count !== 1) throw new HttpError(409, `${product.nameEn} is out of stock`);
      const lineTotal = product.price.mul(requested.quantity);
      subtotal = subtotal.add(lineTotal);
      orderItems.push({ productId: product.id, productNameEn: product.nameEn, productNameKm: product.nameKm, sku: product.sku, unitPrice: product.price, quantity: requested.quantity, lineTotal });
    }
    const deliveryFee = subtotal.greaterThanOrEqualTo(50) ? new Prisma.Decimal(0) : new Prisma.Decimal(2.5);
    const total = subtotal.add(deliveryFee);
    const orderNumber = `MM-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const isEscrow = input.paymentMethod === PaymentMethod.BAKONG_ESCROW;
    const isDemoWallet = input.paymentMethod === PaymentMethod.DEMO_WALLET;
    let walletBalanceAfter: Prisma.Decimal | null = null;

    if (isDemoWallet) {
      if (!userId) throw new HttpError(401, 'Sign in to use the demo wallet');
      const debit = await tx.user.updateMany({
        where: { id: userId, role: 'CUSTOMER', walletBalance: { gte: total } },
        data: { walletBalance: { decrement: total } }
      });
      if (debit.count !== 1) throw new HttpError(409, 'Insufficient demo wallet balance');
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { walletBalance: true } });
      walletBalanceAfter = user.walletBalance;
    }

    const order = await tx.order.create({
      data: {
        orderNumber, userId, customerName: input.customerName, customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone, addressLine: input.addressLine, city: input.city, province: input.province,
        notes: input.notes, subtotal, deliveryFee, total, paymentMethod: input.paymentMethod,
        ...(isDemoWallet ? { status: OrderStatus.CONFIRMED } : {}),
        items: { create: orderItems },
        payment: {
          create: {
            method: input.paymentMethod,
            amount: total,
            ...(isDemoWallet ? { status: PaymentStatus.PAID, provider: 'Demo wallet ledger' } : {})
          }
        },
        ...(isEscrow || isDemoWallet ? {
          escrow: {
            create: {
              ...(isDemoWallet ? {
                contractAddress: 'DEMO_WALLET_LEDGER',
                contractNetwork: 'Database demo only - no real funds',
                buyerAddress: 'DEMO_CUSTOMER_WALLET',
                sellerAddress: 'DEMO_STORE_LEDGER',
                arbiterAddress: 'DEMO_ADMIN_REVIEW'
              } : {
                contractAddress: 'DATABASE_STATUS_ONLY',
                contractNetwork: 'No live contract; database status only',
                buyerAddress: 'NOT_ON_CHAIN',
                sellerAddress: 'NOT_ON_CHAIN',
                arbiterAddress: 'NOT_ON_CHAIN'
              }),
              amount: total,
              status: isDemoWallet ? 'FUNDS_LOCKED' : 'INITIATED',
              inspectionDays: 3,
              ...(isDemoWallet ? { lockedAt: new Date() } : {})
            }
          }
        } : {})
      },
      include: { items: true, payment: true, escrow: true }
    });

    if (isDemoWallet && userId && walletBalanceAfter !== null) {
      await tx.walletTransaction.create({
        data: {
          userId,
          actorUserId: userId,
          orderId: order.id,
          type: WalletTransactionType.ORDER_HOLD,
          amount: total,
          balanceAfter: walletBalanceAfter,
          note: `Demo wallet hold for order ${orderNumber}`
        }
      });
    }

    return order;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}