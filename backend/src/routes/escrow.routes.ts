import { Router } from 'express';
import { getEscrowPublic, handleDisputeEscrow, handleReleaseEscrow } from '../controllers/escrow.controller.js';
import { asyncHandler } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { escrowActionSchema } from '../validators/schemas.js';

const router = Router();

router.get('/:orderNumber', asyncHandler(getEscrowPublic));
router.post('/:orderNumber/release', validateBody(escrowActionSchema), asyncHandler(handleReleaseEscrow));
router.post('/:orderNumber/dispute', validateBody(escrowActionSchema), asyncHandler(handleDisputeEscrow));

export default router;
