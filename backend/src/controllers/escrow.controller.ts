import type { Request, Response } from 'express';
import { EscrowStatus } from '@prisma/client';
import {
  disputeEscrow,
  getEscrowDetails,
  listAdminEscrows,
  markEscrowDispatched,
  releaseEscrowFunds,
  resolveEscrowDispute
} from '../services/escrow.service.js';
import { success } from '../utils/http.js';

export async function getEscrowPublic(req: Request, res: Response) {
  const details = await getEscrowDetails(req.params.orderNumber, req.auth!.userId, req.auth!.role);
  res.json(success(details));
}

export async function handleReleaseEscrow(req: Request, res: Response) {
  const result = await releaseEscrowFunds(req.params.orderNumber, req.auth!.userId);
  res.json(success({
    message: 'Delivery confirmed; the demo escrow status was updated. No real payout was made.',
    ...result
  }));
}

export async function handleDisputeEscrow(req: Request, res: Response) {
  const reason = String(req.body.reason || '').trim();
  const escrow = await disputeEscrow(req.params.orderNumber, reason, req.auth!.userId);
  res.json(success({
    message: 'Dispute recorded for administrator review in the demo database.',
    escrow
  }));
}

export async function handleAdminListEscrows(req: Request, res: Response) {
  const status = typeof req.query.status === 'string' && req.query.status in EscrowStatus
    ? (req.query.status as EscrowStatus)
    : undefined;
  const search = typeof req.query.search === 'string' ? req.query.search : undefined;

  const result = await listAdminEscrows({ status, search });
  res.json(success(result));
}

export async function handleAdminDispatchEscrow(req: Request, res: Response) {
  const days = Number(req.body.inspectionDays) || 3;
  const escrow = await markEscrowDispatched(req.params.orderNumber, days);
  res.json(success({
    message: 'Order marked as dispatched. The inspection countdown is tracked in the database.',
    escrow
  }));
}

export async function handleAdminResolveDispute(req: Request, res: Response) {
  const resolution = req.body.resolution as 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER';
  const notes = String(req.body.notes || 'Arbitrated by store administrator');
  const result = await resolveEscrowDispute(req.params.orderNumber, resolution, notes, req.auth!.userId);
  res.json(success({
    message: `Dispute resolved in the demo ledger: ${resolution === 'RELEASE_TO_SELLER' ? 'hold released to store' : 'customer wallet refunded'}. No real funds moved.`,
    ...result
  }));
}
