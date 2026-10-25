import { Router } from 'express';
import { addItem, getCart, removeItem, updateItem } from '../controllers/cart.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/http.js';
import { z } from 'zod';
import { validateBody } from '../middleware/validate.js';

const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(getCart));
router.post('/items', validateBody(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(50) })), asyncHandler(addItem));
router.patch('/items/:id', validateBody(z.object({ quantity: z.number().int().min(1).max(50) })), asyncHandler(updateItem));
router.delete('/items/:id', asyncHandler(removeItem));
export default router;