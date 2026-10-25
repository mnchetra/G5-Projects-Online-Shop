import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import apiRoutes from './routes/index.js';
import { errorHandler } from './utils/http.js';

export const app = express();
const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim());

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads'), { dotfiles: 'deny', index: false, maxAge: '7d' }));
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/api/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.use('/api', apiRoutes);
app.use((_req, res) => res.status(404).json({ success: false, error: { message: 'Route not found' } }));
app.use(errorHandler);