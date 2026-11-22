import { afterAll, describe, expect, it } from 'vitest';
import { unlink } from 'node:fs/promises';
import path from 'node:path';
import request from 'supertest';
import { app } from '../app.js';
import { prisma } from '../lib/prisma.js';
import { issueSession } from '../middleware/auth.js';
import { checkout } from './order.service.js';
import {
  getEscrowDetails,
  lockEscrowFunds,
  markEscrowDispatched,
  releaseEscrowFunds,
  resolveEscrowDispute
} from './escrow.service.js';

describe('Database-tracked escrow lifecycle', () => {
  const evidenceOrderNumbers: string[] = [];

  afterAll(async () => {
    if (!evidenceOrderNumbers.length) return;
    const records = await prisma.escrowEvidence.findMany({
      where: { escrow: { order: { orderNumber: { in: evidenceOrderNumbers } } } },
      select: { id: true, filename: true, escrowId: true }
    });
    await prisma.escrowEvidence.deleteMany({ where: { id: { in: records.map((record) => record.id) } } });
    const directory = path.resolve(process.env.ESCROW_EVIDENCE_DIRECTORY || path.join(process.cwd(), 'private_uploads', 'escrow-evidence'));
    await Promise.all(records.map(async ({ filename }) => {
      try {
        await unlink(path.join(directory, filename));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }));
  });

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
    const admin = await prisma.user.create({
      data: { email: `dispute-admin-${Date.now()}@example.com`, name: 'Store Admin Test', passwordHash: 'test-only', role: 'ADMIN' }
    });
    const superAdmin = await prisma.user.create({
      data: { email: `dispute-superadmin-${Date.now()}@example.com`, name: 'Super Admin Test', passwordHash: 'test-only', role: 'SUPER_ADMIN' }
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
    evidenceOrderNumbers.push(order.orderNumber);

    // Lock funds
    await lockEscrowFunds({
      orderNumber: order.orderNumber,
      bakongMd5: 'c4ca4238a0b923820dcc509a6f75849b'
    });

    const adminSession = await issueSession(admin);
    const directCancel = await request(app)
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Cookie', `mekong_session=${adminSession}`)
      .send({ status: 'CANCELLED' });
    expect(directCancel.status).toBe(409);

    // Dispatch
    await markEscrowDispatched(order.orderNumber, 3);

    // Buyer submits the report with a private image attachment.
    const buyerSession = await issueSession(buyer);
    const pngProof = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0u8AAAAASUVORK5CYII=', 'base64');
    const disputeResponse = await request(app)
      .post(`/api/escrow/${encodeURIComponent(order.orderNumber)}/dispute`)
      .set('Cookie', `mekong_session=${buyerSession}`)
      .field('reason', 'Item arrived damaged during transport')
      .attach('evidence', pngProof, { filename: 'damaged-item.png', contentType: 'image/png' });
    expect(disputeResponse.status).toBe(200);
    const disputed = disputeResponse.body.data.escrow;
    expect(disputed.status).toBe('DISPUTED');
    expect(disputed.disputeReason).toBe('Item arrived damaged during transport');
    expect(disputed.evidence).toHaveLength(1);
    expect(disputed.evidence[0]).toMatchObject({ stage: 'CUSTOMER', originalName: 'damaged-item.png', mimeType: 'image/png' });

    const evidenceId = disputed.evidence[0].id;
    const evidenceFile = await request(app)
      .get(`/api/escrow/${encodeURIComponent(order.orderNumber)}/evidence/${evidenceId}`)
      .set('Cookie', `mekong_session=${buyerSession}`);
    expect(evidenceFile.status).toBe(200);
    expect(evidenceFile.headers['content-type']).toMatch(/^image\/png/);
    expect(evidenceFile.body).toEqual(pngProof);

    const otherCustomer = await prisma.user.create({
      data: { email: `evidence-outsider-${Date.now()}@example.com`, name: 'Evidence Outsider', passwordHash: 'test-only' }
    });
    const outsiderSession = await issueSession(otherCustomer);
    const forbiddenEvidence = await request(app)
      .get(`/api/escrow/${encodeURIComponent(order.orderNumber)}/evidence/${evidenceId}`)
      .set('Cookie', `mekong_session=${outsiderSession}`);
    expect(forbiddenEvidence.status).toBe(403);

    await expect(resolveEscrowDispute(order.orderNumber, 'REFUND_TO_BUYER', 'Damaged in transit verified.', superAdmin.id))
      .rejects.toThrow('The administrator must respond before Super Admin arbitration');

    const mp4Proof = Buffer.from('AAAAGGZ0eXBtcDQyAAAAAGlzb20=', 'base64');
    const responseResult = await request(app)
      .post(`/api/admin/escrows/${encodeURIComponent(order.orderNumber)}/respond`)
      .set('Cookie', `mekong_session=${adminSession}`)
      .field('response', 'Item was checked and packed in good condition.')
      .attach('evidence', mp4Proof, { filename: 'packing-video.mp4', contentType: 'video/mp4' });
    expect(responseResult.status).toBe(200);
    const response = responseResult.body.data.escrow;
    expect(response.adminResponse).toBe('Item was checked and packed in good condition.');
    expect(response.adminRespondedByUserId).toBe(admin.id);
    expect(response.evidence).toHaveLength(2);
    expect(response.evidence[1]).toMatchObject({ stage: 'ADMIN', originalName: 'packing-video.mp4', mimeType: 'video/mp4' });

    // Only the final Super Admin decision resolves the dispute.
    const superAdminSession = await issueSession(superAdmin);
    const resolutionResponse = await request(app)
      .post(`/api/admin/escrows/${encodeURIComponent(order.orderNumber)}/resolve`)
      .set('Cookie', `mekong_session=${superAdminSession}`)
      .field('resolution', 'REFUND_TO_BUYER')
      .field('notes', 'Damage verified from the customer evidence.')
      .field('restockItems', 'false')
      .attach('evidence', pngProof, { filename: 'damage-confirmation.png', contentType: 'image/png' });
    expect(resolutionResponse.status).toBe(200);
    const resolution = resolutionResponse.body.data;
    expect(resolution.escrow.status).toBe('REFUNDED');
    expect(resolution.escrow.refundTxHash).toBeNull();
    expect(resolution.escrow.disputeReason).toBe('Item arrived damaged during transport');
    expect(resolution.escrow.resolutionNotes).toBe('Damage verified from the customer evidence.');
    expect(resolution.escrow.arbitratedByUserId).toBe(superAdmin.id);
    expect(resolution.escrow.inventoryRestocked).toBe(false);
    expect(resolution.escrow.evidence).toHaveLength(3);
    expect(resolution.escrow.evidence[2]).toMatchObject({ stage: 'SUPER_ADMIN', originalName: 'damage-confirmation.png' });
  });
});
