import { Router } from 'express';
import adminRoutes from './admin.routes.js';
import authRoutes from './auth.routes.js';
import cartRoutes from './cart.routes.js';
import catalogRoutes from './catalog.routes.js';
import orderRoutes from './order.routes.js';
import paymentRoutes from './payment.routes.js';
import userRoutes from './user.routes.js';

const router = Router();
router.use('/auth', authRoutes);
router.use('/', catalogRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/payments', paymentRoutes);
router.use('/users', userRoutes);
router.use('/admin', adminRoutes);
export default router;