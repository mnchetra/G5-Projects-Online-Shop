import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { currentUser, signIn, signOut, signUp } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false });
router.post('/register', authLimiter, validateBody(registerSchema), asyncHandler(signUp));
router.post('/login', authLimiter, validateBody(loginSchema), asyncHandler(signIn));
router.post('/logout', signOut);
router.get('/me', requireAuth, asyncHandler(currentUser));
export default router;