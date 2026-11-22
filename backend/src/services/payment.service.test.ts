import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertBakongConfigured, checkBakongKhqr, createBakongKhqr } from './payment.service.js';

const configureGateway = () => {
  vi.stubEnv('KHQR_API_BASE_URL', 'https://lorndavid.online');
  vi.stubEnv('BAKONG_ACCOUNT_ID', 'mekong_shop@bkrt');
  vi.stubEnv('BAKONG_MERCHANT_NAME', 'Mekong Shop');
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('Bakong KHQR gateway adapter', () => {
  it('requires merchant settings before an ABA order can be created', () => {
    vi.stubEnv('BAKONG_ACCOUNT_ID', '');
    vi.stubEnv('BAKONG_MERCHANT_NAME', '');

    expect(() => assertBakongConfigured()).toThrow('merchant settings are not configured');
  });

  it('creates a server-priced USD KHQR using the documented GET parameters', async () => {
    configureGateway();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      qr: 'EMVCO-KHQR-PAYLOAD',
      md5: 'e2fc714c4727ee9395f324cd2e7f331f',
      qrImage: 'data:image/png;base64,aGVsbG8='
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await createBakongKhqr({ orderNumber: 'MM-ORDER-123', amount: 28.5 });
    const [url, options] = fetchMock.mock.calls[0] as [string | URL, RequestInit];
    const requestUrl = new URL(String(url));

    expect(requestUrl.origin + requestUrl.pathname).toBe('https://lorndavid.online/api/v1/khqr/generate');
    expect(Object.fromEntries(requestUrl.searchParams)).toEqual({
      accountId: 'mekong_shop@bkrt',
      amount: '28.50',
      currency: 'USD',
      billNumber: 'MM-ORDER-123',
      merchantName: 'Mekong Shop'
    });
    expect(options.method).toBe('GET');
    expect(options.body).toBeUndefined();
    expect(new Headers(options.headers).has('authorization')).toBe(false);
    expect(result.md5).toBe('e2fc714c4727ee9395f324cd2e7f331f');
    expect(result.qrImage).toContain('data:image/png;base64,');
  });

  it('accepts the qrString response field documented by the gateway', async () => {
    configureGateway();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      qrString: 'EMVCO-QR-STRING',
      md5: 'e2fc714c4727ee9395f324cd2e7f331f',
      qrImage: 'data:image/png;base64,aGVsbG8='
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(createBakongKhqr({ orderNumber: 'MM-ORDER-124', amount: 12.5 })).resolves.toMatchObject({ qr: 'EMVCO-QR-STRING' });
  });

  it('recognizes responseCode zero as confirmed payment', async () => {
    configureGateway();
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ responseCode: 0, data: { md5: 'payment-reference' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(checkBakongKhqr('payment-reference')).resolves.toEqual({ paid: true });
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://lorndavid.online/api/v1/check/payment-reference');
  });

  it('surfaces the provider HTTP status when QR generation is rejected', async () => {
    configureGateway();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 400 })));

    await expect(createBakongKhqr({ orderNumber: 'MM-ORDER-125', amount: 12.5 }))
      .rejects.toThrow('HTTP 400');
  });

  it('rejects a non-HTTPS provider URL', async () => {
    configureGateway();
    vi.stubEnv('KHQR_API_BASE_URL', 'http://lorndavid.online');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(createBakongKhqr({ orderNumber: 'MM-ORDER-123', amount: 28.5 })).rejects.toThrow('must use HTTPS');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
