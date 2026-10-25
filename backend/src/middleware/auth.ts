import type { Request, RequestHandler } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http.js';

if (process.env.NODE_ENV === 'production' && process.env.COOKIE_SECURE !== 'true') {
  throw new Error('Production auth cookies must use COOKIE_SECURE=true');
}

const cookieName = 'mekong_session';
const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000;

export function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function issueSession(user: { id: string }) {
  await prisma.session.deleteMany({ where: { expiresAt: { lte: new Date() } } });
  const token = randomBytes(32).toString('base64url');
  await prisma.session.create({ data: { tokenHash: hashSessionToken(token), userId: user.id, expiresAt: new Date(Date.now() + sessionLifetimeMs) } });
  return token;
}

export const sessionCookie = {
  name: cookieName,
  options: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: sessionLifetimeMs
  }
};

async function attachSession(req: Request) {
  const token = req.cookies?.[cookieName];
  if (!token) return false;
  const session = await prisma.session.findUnique({ where: { tokenHash: hashSessionToken(token) }, include: { user: { select: { id: true, role: true } } } });
  if (!session) throw new HttpError(401, 'Invalid session');
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({ where: { id: session.id } });
    throw new HttpError(401, 'Session expired');
  }
  if (!Object.values(UserRole).includes(session.user.role)) throw new HttpError(401, 'Invalid session');
  req.auth = { userId: session.user.id, role: session.user.role, sessionId: session.id };
  return true;
}

export const optionalAuth: RequestHandler = (req, _res, next) => {
  void attachSession(req).then(() => next()).catch(next);
};

export const requireAuth: RequestHandler = (req, _res, next) => {
  void attachSession(req).then((authenticated) => {
    if (!authenticated) return next(new HttpError(401, 'Authentication required'));
    next();
  }).catch(next);
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== UserRole.ADMIN) return next(new HttpError(403, 'Administrator access required'));
  next();
};