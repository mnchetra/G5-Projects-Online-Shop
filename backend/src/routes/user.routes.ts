import { Router } from 'express';
import { z } from 'zod';
import { addAddress, addresses, updateProfile } from '../controllers/user.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.use(requireAuth);
router.get('/addresses', asyncHandler(addresses));
router.post('/addresses', validateBody(z.object({ recipient: z.string().trim().min(2), phone: z.string().trim().min(6), line1: z.string().trim().min(5), city: z.string().trim().min(2), province: z.string().trim().min(2), postalCode: z.string().optional(), isDefault: z.boolean().optional() })), asyncHandler(addAddress));
router.patch('/profile', validateBody(z.object({ name: z.string().trim().min(2).max(100).optional(), phone: z.string().trim().min(6).max(30).optional() })), asyncHandler(updateProfile));
export default router;