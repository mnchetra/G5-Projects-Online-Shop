import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { checkOrderKhqrStatus, retryOrderKhqr } from '../controllers/order.controller.js';
import { asyncHandler } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { khqrOrderAccessSchema } from '../validators/schemas.js';

const router = Router();
const khqrLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100, standardHeaders: 'draft-7', legacyHeaders: false });

router.post('/aba/:orderNumber/khqr', khqrLimiter, validateBody(khqrOrderAccessSchema), asyncHandler(retryOrderKhqr));
router.post('/aba/:orderNumber/status', khqrLimiter, validateBody(khqrOrderAccessSchema), asyncHandler(checkOrderKhqrStatus));

export default router;