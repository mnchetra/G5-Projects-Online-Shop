import { Router } from 'express';
import { getEscrowPublic, handleDisputeEscrow, handleReleaseEscrow } from '../controllers/escrow.controller.js';
import { asyncHandler } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { escrowActionSchema } from '../validators/schemas.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/:orderNumber', requireAuth, asyncHandler(getEscrowPublic));
router.post('/:orderNumber/release', requireAuth, validateBody(escrowActionSchema), asyncHandler(handleReleaseEscrow));
router.post('/:orderNumber/dispute', requireAuth, validateBody(escrowActionSchema), asyncHandler(handleDisputeEscrow));

export default router;
