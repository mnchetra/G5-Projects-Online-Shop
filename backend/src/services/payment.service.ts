import { z } from 'zod';
import { HttpError } from '../utils/http.js';

export interface PaymentProvider {
  createPayment(input: { orderId: string; amount: string; currency: string }): Promise<{ reference: string; redirectUrl?: string }>;
  verifyPayment(reference: string): Promise<'PENDING' | 'PAID' | 'FAILED'>;
}

export const cashOnDelivery = {
  method: 'CASH_ON_DELIVERY' as const,
  async createPayment(input: { orderId: string; amount: string }) {
    return { reference: `COD-${input.orderId}`, amountDueAtDelivery: input.amount };
  }
};

const khqrResponseSchema = z.object({
  qr: z.string().min(1).optional(),
  qrString: z.string().min(1).optional(),
  md5: z.string().regex(/^[a-f0-9]{32}$/i),
  qrImage: z.string().min(1)
});
const khqrStatusSchema = z.object({ responseCode: z.union([z.number(), z.string()]) }).passthrough();

function gatewayConfig() {
  const accountId = process.env.BAKONG_ACCOUNT_ID?.trim();
  const merchantName = process.env.BAKONG_MERCHANT_NAME?.trim();
  const storeLabel = process.env.BAKONG_STORE_LABEL?.trim() || 'Main Store';
  if (!accountId || !merchantName || accountId.toLowerCase().includes('your_')) {
    throw new HttpError(503, 'Bakong merchant settings are not configured');
  }

  let apiBase: URL;
  try {
    apiBase = new URL(process.env.KHQR_API_BASE_URL?.trim() || 'https://lorndavid.online');
  } catch {
    throw new HttpError(503, 'Bakong payment provider URL is invalid');
  }
  if (apiBase.protocol !== 'https:') throw new HttpError(503, 'Bakong payment provider must use HTTPS');

  return { accountId, merchantName, storeLabel, apiBase };
}

export function assertBakongConfigured() {
  gatewayConfig();
}

async function readGatewayJson(response: Response) {
  if (!response.ok) throw new HttpError(502, 'Bakong payment provider request failed');
  try {
    return await response.json() as unknown;
  } catch {
    throw new HttpError(502, 'Bakong payment provider returned an invalid response');
  }
}

async function requestGateway(url: URL, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch {
    throw new HttpError(502, 'Bakong payment provider is unavailable');
  }
}

export async function createBakongKhqr(input: { orderNumber: string; amount: number }) {
  const config = gatewayConfig();
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new HttpError(400, 'Payment amount is invalid');

  const response = await requestGateway(new URL('/api/v1/khqr/generate', config.apiBase), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId: config.accountId,
      merchantName: config.merchantName,
      amount: Number(input.amount.toFixed(2)),
      currency: 'USD',
      billNumber: input.orderNumber,
      storeLabel: config.storeLabel
    }),
    signal: AbortSignal.timeout(10000)
  });
  const body = await readGatewayJson(response);
  const candidate = typeof body === 'object' && body !== null && 'data' in body ? body.data : body;
  const parsed = khqrResponseSchema.safeParse(candidate);
  if (!parsed.success || (!parsed.data.qr && !parsed.data.qrString)) throw new HttpError(502, 'Bakong payment provider returned an invalid QR response');
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(parsed.data.qrImage) && !/^https:\/\//i.test(parsed.data.qrImage)) {
    throw new HttpError(502, 'Bakong payment provider returned an unsupported QR image');
  }
  return { qr: parsed.data.qrString ?? parsed.data.qr!, md5: parsed.data.md5, qrImage: parsed.data.qrImage };
}

export async function checkBakongKhqr(md5: string) {
  const { apiBase } = gatewayConfig();
  const response = await requestGateway(new URL(`/api/v1/check/${encodeURIComponent(md5)}`, apiBase), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000)
  });
  const body = await readGatewayJson(response);
  const candidate = typeof body === 'object' && body !== null && 'responseCode' in body
    ? body
    : typeof body === 'object' && body !== null && 'data' in body
      ? body.data
      : body;
  const parsed = khqrStatusSchema.safeParse(candidate);
  if (!parsed.success) throw new HttpError(502, 'Bakong payment provider returned an invalid status response');
  return { paid: Number(parsed.data.responseCode) === 0 };
}