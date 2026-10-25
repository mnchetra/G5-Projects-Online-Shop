import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app } from './app.js';
import { checkoutSchema } from './validators/schemas.js';

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
  });
});