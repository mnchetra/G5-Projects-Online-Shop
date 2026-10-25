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
  const details = await getEscrowDetails(req.params.orderNumber);
  res.json(success(details));
}

export async function handleReleaseEscrow(req: Request, res: Response) {
  const customerPhone = typeof req.body.customerPhone === 'string' ? req.body.customerPhone : undefined;
  const result = await releaseEscrowFunds(req.params.orderNumber, customerPhone);
  res.json(success({
    message: 'Escrow funds successfully released to seller via smart contract',
    ...result
  }));
}

export async function handleDisputeEscrow(req: Request, res: Response) {
  const reason = String(req.body.reason || '').trim();
  const customerPhone = typeof req.body.customerPhone === 'string' ? req.body.customerPhone : undefined;
  const escrow = await disputeEscrow(req.params.orderNumber, reason, customerPhone);
  res.json(success({
    message: 'Dispute has been registered with the escrow arbiter',
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
    message: 'Order marked as dispatched. Inspection countdown active on smart contract.',
    escrow
  }));
}

export async function handleAdminResolveDispute(req: Request, res: Response) {
  const resolution = req.body.resolution as 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER';
  const notes = String(req.body.notes || 'Arbitrated by store administrator');
  const result = await resolveEscrowDispute(req.params.orderNumber, resolution, notes);
  res.json(success({
    message: `Dispute resolved: ${resolution === 'RELEASE_TO_SELLER' ? 'Funds released to seller' : 'Refund granted to buyer'}`,
    ...result
  }));
}
