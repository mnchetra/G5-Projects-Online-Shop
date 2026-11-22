import rateLimit from 'express-rate-limit';

export const khqrGenerationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 2,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

export const khqrOrderLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 2,
  skip: (req) => req.body?.paymentMethod !== 'ABA_KHQR' && req.body?.paymentMethod !== 'BAKONG_ESCROW',
  standardHeaders: 'draft-7',
  legacyHeaders: false
});

export const khqrStatusLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false
});
