import type { Request, Response } from 'express';
import { readFile } from 'node:fs/promises';
import { EscrowStatus } from '@prisma/client';
import {
  disputeEscrow,
  getEscrowEvidenceFile,
  getEscrowDetails,
  listAdminEscrows,
  markEscrowDispatched,
  respondToEscrowDispute,
  releaseEscrowFunds,
  resolveEscrowDispute
} from '../services/escrow.service.js';
import { HttpError, success } from '../utils/http.js';

function evidenceFiles(req: Request) {
  return (req.files as Express.Multer.File[] | undefined) ?? [];
}

export async function getEscrowPublic(req: Request, res: Response) {
  const details = await getEscrowDetails(req.params.orderNumber, req.auth!.userId, req.auth!.role);
  res.json(success(details));
}

export async function handleGetEscrowEvidence(req: Request, res: Response) {
  const file = await getEscrowEvidenceFile(
    req.params.orderNumber,
    req.params.evidenceId,
    req.auth!.userId,
    req.auth!.role
  );
  let contents: Buffer;
  try {
    contents = await readFile(file.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new HttpError(404, 'Evidence file is no longer available');
    throw error;
  }
  res.set({
    'Content-Type': file.mimeType,
    'Content-Length': String(file.fileSize),
    'Content-Disposition': 'inline',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff'
  }).send(contents);
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
  const escrow = await disputeEscrow(req.params.orderNumber, reason, req.auth!.userId, evidenceFiles(req));
  res.json(success({
    message: 'Cancellation or return request recorded. The administrator must respond before a Super Admin makes the final decision.',
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

export async function handleAdminRespondToDispute(req: Request, res: Response) {
  const escrow = await respondToEscrowDispute(req.params.orderNumber, req.body.response, req.auth!.userId, evidenceFiles(req));
  res.json(success({
    message: 'Administrator response recorded. The held case is awaiting final Super Admin review.',
    escrow
  }));
}

export async function handleAdminResolveDispute(req: Request, res: Response) {
  const resolution = req.body.resolution as 'RELEASE_TO_SELLER' | 'REFUND_TO_BUYER';
  const notes = String(req.body.notes || '');
  const result = await resolveEscrowDispute(
    req.params.orderNumber,
    resolution,
    notes,
    req.auth!.userId,
    req.body.restockItems,
    evidenceFiles(req)
  );
  res.json(success({
    message: `Final Super Admin decision recorded: ${resolution === 'RELEASE_TO_SELLER' ? 'hold released to store' : 'customer refund approved'}. No real funds moved.`,
    ...result
  }));
}
