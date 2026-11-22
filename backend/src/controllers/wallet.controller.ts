import type { Request, Response } from 'express';
import { assertBakongConfigured } from '../services/payment.service.js';
import { checkWalletTopUp, createWalletTopUp } from '../services/wallet-topup.service.js';
import { success } from '../utils/http.js';

export async function createTopUp(req: Request, res: Response) {
  assertBakongConfigured();
  const topUp = await createWalletTopUp(req.auth!.userId, req.body.amount);
  res.status(201).json(success({ topUp }));
}

export async function checkTopUp(req: Request, res: Response) {
  const result = await checkWalletTopUp(req.auth!.userId, req.params.topUpId);
  res.json(success(result));
}
