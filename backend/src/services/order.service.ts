import { PaymentMethod, Prisma } from '@prisma/client';
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
    return tx.order.create({
      data: {
        orderNumber, userId, customerName: input.customerName, customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone, addressLine: input.addressLine, city: input.city, province: input.province,
        notes: input.notes, subtotal, deliveryFee, total, paymentMethod: input.paymentMethod,
        items: { create: orderItems },
        payment: { create: { method: input.paymentMethod, amount: total } }
      },
      include: { items: true, payment: true }
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}