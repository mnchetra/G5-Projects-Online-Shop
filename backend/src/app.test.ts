import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { checkoutSchema, walletAdjustmentSchema } from './validators/schemas.js';

describe('API', () => {
  it('reports healthy without requiring a database connection', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('returns a consistent JSON response for unknown routes', async () => {
    const response = await request(app).get('/api/not-a-route');
    expect(response.status).toBe(404);
    expect(response.body.error.message).toBe('Route not found');
  });

  it('rejects invalid registration data before reaching persistence', async () => {
    const response = await request(app).post('/api/auth/register').send({ email: 'not-an-email', password: 'short' });
    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe('Invalid request data');
  });

  it('protects administrator routes from unauthenticated requests', async () => {
    const response = await request(app).get('/api/admin/dashboard');
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Authentication required');
  });

  it('protects wallet adjustments and escrow actions from unauthenticated requests', async () => {
    const adjustment = await request(app).post('/api/admin/customers/customer-id/wallet-adjustments').send({
      direction: 'CREDIT',
      amount: 10,
      note: 'Test credit'
    });
    const release = await request(app).post('/api/escrow/order-id/release').send({});
    expect(adjustment.status).toBe(401);
    expect(release.status).toBe(401);
  });

  it('requires authentication before checkout', async () => {
    const response = await request(app).post('/api/orders').send({});
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Authentication required');
  });

  it('supports ABA KHQR checkout while keeping COD as the backward-compatible default', () => {
    const checkout = {
      customerName: 'Sokha Chan',
      customerPhone: '+85512345678',
      addressLine: '12 Street 240',
      city: 'Phnom Penh',
      province: 'Phnom Penh',
      items: [{ productId: 'mekong-rattan-lamp', quantity: 1 }]
    };

    expect(checkoutSchema.parse(checkout).paymentMethod).toBe('CASH_ON_DELIVERY');
    expect(checkoutSchema.parse({ ...checkout, paymentMethod: 'ABA_KHQR' }).paymentMethod).toBe('ABA_KHQR');
    expect(checkoutSchema.parse({ ...checkout, paymentMethod: 'DEMO_WALLET' }).paymentMethod).toBe('DEMO_WALLET');
  });

  it('validates demo wallet adjustments and rejects amounts with fractional cents', () => {
    expect(walletAdjustmentSchema.safeParse({ direction: 'CREDIT', amount: 25.5, note: 'Customer demo credit' }).success).toBe(true);
    expect(walletAdjustmentSchema.safeParse({ direction: 'DEBIT', amount: 1.005, note: 'Correction' }).success).toBe(false);
    expect(walletAdjustmentSchema.safeParse({ direction: 'DEBIT', amount: 0, note: 'Correction' }).success).toBe(false);
  });
});