import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { HttpError } from '../utils/http.js';

export async function register(input: { name: string; email: string; phone?: string; password: string }) {
  const email = input.email.toLowerCase();
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, 'An account with this email already exists');
  const user = await prisma.user.create({
    data: { name: input.name, email, phone: input.phone, passwordHash: await bcrypt.hash(input.password, 12) },
    select: { id: true, name: true, email: true, phone: true, role: true }
  });
  return user;
}

export async function login(emailInput: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email: emailInput.toLowerCase() } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'Email or password is incorrect');
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}