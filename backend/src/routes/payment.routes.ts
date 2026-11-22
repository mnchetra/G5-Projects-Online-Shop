import { Router } from 'express';
import { checkOrderKhqrStatus, retryOrderKhqr } from '../controllers/order.controller.js';
import { asyncHandler } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { khqrOrderAccessSchema } from '../validators/schemas.js';
import { khqrGenerationLimiter, khqrStatusLimiter } from '../middleware/khqrRateLimit.js';

const router = Router();

router.post('/aba/:orderNumber/khqr', khqrGenerationLimiter, validateBody(khqrOrderAccessSchema), asyncHandler(retryOrderKhqr));
router.post('/aba/:orderNumber/status', khqrStatusLimiter, validateBody(khqrOrderAccessSchema), asyncHandler(checkOrderKhqrStatus));

export default router;