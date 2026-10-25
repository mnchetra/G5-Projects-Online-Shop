import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(6).max(30).optional(),
  password: z.string().min(10).max(128)
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128)
});

export const checkoutSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  customerEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  customerPhone: z.string().trim().min(6).max(30),
  addressLine: z.string().trim().min(5).max(240),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
  notes: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(['CASH_ON_DELIVERY', 'ABA_KHQR', 'BAKONG_ESCROW']).default('CASH_ON_DELIVERY'),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(50) })).min(1).max(50)
});

export const khqrOrderAccessSchema = z.object({
  customerPhone: z.string().trim().min(6).max(30)
});

export const escrowActionSchema = z.object({
  customerPhone: z.string().trim().min(6).max(30).optional(),
  reason: z.string().trim().min(5).max(1000).optional(),
  buyerAddress: z.string().trim().max(100).optional()
});

export const escrowResolveSchema = z.object({
  resolution: z.enum(['RELEASE_TO_SELLER', 'REFUND_TO_BUYER']),
  notes: z.string().trim().min(3).max(1000)
});

export const productSchema = z.object({
  slug: z.string().trim().min(2).max(140).regex(/^[a-z0-9-]+$/),
  sku: z.string().trim().min(2).max(80),
  nameEn: z.string().trim().min(2).max(180),
  nameKm: z.string().trim().min(2).max(180),
  descriptionEn: z.string().trim().min(2).max(5000),
  descriptionKm: z.string().trim().min(2).max(5000),
  price: z.number().positive(),
  compareAtPrice: z.number().positive().optional(),
  stock: z.number().int().min(0),
  categoryId: z.string().min(1),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  imageUrl: z.string().url().optional()
});

export const orderStatusSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'])
});