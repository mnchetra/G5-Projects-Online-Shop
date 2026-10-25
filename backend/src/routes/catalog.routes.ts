import { Router } from 'express';
import { categories, product, products } from '../controllers/catalog.controller.js';
import { asyncHandler } from '../utils/http.js';

const router = Router();
router.get('/categories', asyncHandler(categories));
router.get('/products', asyncHandler(products));
router.get('/products/:id', asyncHandler(product));
export default router;