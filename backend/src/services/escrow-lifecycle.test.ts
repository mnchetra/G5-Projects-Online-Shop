import { describe, expect, it } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { checkout } from './order.service.js';
import {
  disputeEscrow,
  getEscrowDetails,
  lockEscrowFunds,
  markEscrowDispatched,
  releaseEscrowFunds,
  resolveEscrowDispute
} from './escrow.service.js';

describe('Database-tracked escrow lifecycle', () => {
  it('records checkout, dispatch, delivery confirmation, and release status', async () => {
    const product = await prisma.product.findFirst({ where: { isActive: true } });
    expect(product).toBeDefined();
    const buyer = await prisma.user.create({
      data: { email: `escrow-test-${Date.now()}@example.com`, name: 'Sophea Escrow Test', passwordHash: 'test-only' }
    });

    // 1. Checkout with BAKONG_ESCROW
    const order = await checkout({
      customerName: 'Sophea Escrow Test',
      customerPhone: '098765432',
      customerEmail: 'sophea@example.com',
      addressLine: 'Street 51, BKK1',
      city: 'Phnom Penh',
      province: 'Phnom Penh',
      paymentMethod: 'BAKONG_ESCROW',
      items: [{ productId: product!.id, quantity: 1 }]
    }, buyer.id);

    expect(order.orderNumber).toBeDefined();
    expect(order.paymentMethod).toBe('BAKONG_ESCROW');
    expect(order.escrow).toBeDefined();
    expect(order.escrow?.status).toBe('INITIATED');

    // 2. Lock Funds via Bakong KHQR payment verification
    const locked = await lockEscrowFunds({
      orderNumber: order.orderNumber,
      bakongMd5: '9b73c66f31289feef544d6daec2b2a68'
    });
    expect(locked.status).toBe('FUNDS_LOCKED');
    expect(locked.bakongMd5).toBe('9b73c66f31289feef544d6daec2b2a68');
    expect(locked.lockedAt).toBeDefined();

    // 3. Seller marks order as dispatched with 3-day inspection window
    const dispatched = await markEscrowDispatched(order.orderNumber, 3);
    expect(dispatched.status).toBe('DISPATCHED');
    expect(dispatched.autoReleaseAt).toBeDefined();

    // 4. The authenticated buyer confirms receipt.
    const releaseResult = await releaseEscrowFunds(order.orderNumber, buyer.id);
    expect(releaseResult.escrow.status).toBe('RELEASED');
    expect(releaseResult.releaseTxHash).toBeNull();

    // 5. Details are visible to the owning buyer.
    const details = await getEscrowDetails(order.orderNumber, buyer.id);
    expect(details.escrow?.status).toBe('RELEASED');
    expect(details.paymentMethod).toBe('BAKONG_ESCROW');
  });

  it('handles dispute and arbitration flow', async () => {
    const product = await prisma.product.findFirst({ where: { isActive: true } });
    expect(product).toBeDefined();
    const buyer = await prisma.user.create({
      data: { email: `dispute-test-${Date.now()}@example.com`, name: 'Dara Dispute Test', passwordHash: 'test-only' }
    });

    // Checkout
    const order = await checkout({
      customerName: 'Dara Dispute Test',
      customerPhone: '011223344',
      addressLine: 'Toul Kork',
      city: 'Phnom Penh',
      province: 'Phnom Penh',
      paymentMethod: 'BAKONG_ESCROW',
      items: [{ productId: product!.id, quantity: 1 }]
    }, buyer.id);

    // Lock funds
    await lockEscrowFunds({
      orderNumber: order.orderNumber,
      bakongMd5: 'c4ca4238a0b923820dcc509a6f75849b'
    });

    // Dispatch
    await markEscrowDispatched(order.orderNumber, 3);

    // Buyer files dispute
    const disputed = await disputeEscrow(order.orderNumber, 'Item arrived damaged during transport', buyer.id);
    expect(disputed.status).toBe('DISPUTED');
    expect(disputed.disputeReason).toContain('Item arrived damaged');

    // Arbiter resolves dispute with refund to buyer
    const resolution = await resolveEscrowDispute(order.orderNumber, 'REFUND_TO_BUYER', 'Damaged in transit verified. Refund granted.', buyer.id);
    expect(resolution.escrow.status).toBe('REFUNDED');
    expect(resolution.escrow.refundTxHash).toBeNull();
  });
});
