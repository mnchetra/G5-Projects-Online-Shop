import type { Request, Response } from 'express';
import { login, register } from '../services/auth.service.js';
import { hashSessionToken, issueSession, sessionCookie } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { success } from '../utils/http.js';

export async function signUp(req: Request, res: Response) {
  const user = await register(req.body);
  res.cookie(sessionCookie.name, await issueSession(user), sessionCookie.options);
  res.status(201).json(success({ user }));
}

export async function signIn(req: Request, res: Response) {
  const user = await login(req.body.email, req.body.password);
  res.cookie(sessionCookie.name, await issueSession(user), sessionCookie.options);
  res.json(success({ user }));
}

export async function signOut(req: Request, res: Response) {
  const token = req.cookies?.[sessionCookie.name];
  if (token) await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
  res.clearCookie(sessionCookie.name, { ...sessionCookie.options, maxAge: undefined });
  res.json(success({ loggedOut: true }));
}

export async function currentUser(req: Request, res: Response) {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { id: true, name: true, email: true, phone: true, role: true } });
  res.json(success({ user }));
}