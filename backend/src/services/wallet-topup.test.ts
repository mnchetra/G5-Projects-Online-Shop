import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { prisma } from '../lib/prisma.js';
import { checkWalletTopUp, createWalletTopUp } from './wallet-topup.service.js';

const userIds: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

describe('KHQR wallet top-ups', () => {
  it('credits the wallet exactly once after the provider confirms payment', async () => {
    vi.stubEnv('KHQR_API_BASE_URL', 'https://lorndavid.online');
    vi.stubEnv('BAKONG_ACCOUNT_ID', 'store@example@bkrt');
    vi.stubEnv('BAKONG_MERCHANT_NAME', 'Test Store');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        qrString: 'EMVCO-WALLET-QR',
        md5: 'e2fc714c4727ee9395f324cd2e7f331f',
        qrImage: 'data:image/png;base64,aGVsbG8='
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ responseCode: 1 }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ responseCode: 0 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const user = await prisma.user.create({
      data: {
        email: `wallet-topup-${randomUUID()}@example.test`,
        name: 'Wallet Top-up Test',
        passwordHash: 'test-only'
      }
    });
    userIds.push(user.id);

    const topUp = await createWalletTopUp(user.id, 25.25);
    expect(topUp.qrImage).toContain('data:image/png;base64,');
    expect(Number(topUp.amount)).toBe(25.25);
    expect(topUp.billNumber.length).toBeLessThanOrEqual(20);

    const pending = await checkWalletTopUp(user.id, topUp.id);
    expect(pending.status).toBe('PENDING');
    expect(pending.balance).toBe('0');

    const paid = await checkWalletTopUp(user.id, topUp.id);
    expect(paid.status).toBe('PAID');
    expect(paid.balance).toBe('25.25');

    await expect(checkWalletTopUp(user.id, topUp.id)).resolves.toMatchObject({ status: 'PAID', balance: '25.25' });
    expect(await prisma.walletTransaction.count({ where: { walletTopUpId: topUp.id } })).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejects non-positive and sub-cent amounts', async () => {
    await expect(createWalletTopUp('unused-user', 0)).rejects.toThrow('positive amount');
    await expect(createWalletTopUp('unused-user', 1.001)).rejects.toThrow('two decimal places');
  });
});
