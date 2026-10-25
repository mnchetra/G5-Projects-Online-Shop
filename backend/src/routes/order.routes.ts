import { Router } from 'express';
import { createOrder, getOrder, listOrders } from '../controllers/order.controller.js';
import { optionalAuth, requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { validateBody } from '../middleware/validate.js';
import { checkoutSchema } from '../validators/schemas.js';

const router = Router();
router.post('/', requireAuth, validateBody(checkoutSchema), asyncHandler(createOrder));
router.get('/', requireAuth, asyncHandler(listOrders));
router.get('/:orderNumber', requireAuth, asyncHandler(getOrder));
export default router;