import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../utils/tokens';
import { config } from '../config';
import { logger } from '../utils/logger';
import type { Request, Response } from 'express';

const REFRESH_COOKIE = 'ms_rt';

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'strict',    // mitigates CSRF on the cookie-based refresh flow
    path: '/api/auth',
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth', httpOnly: true, sameSite: 'strict', secure: config.isProd });
}

export async function signup(email: string, password: string, name?: string): Promise<{ access: string; refresh: string; user: { id: string; email: string; role: string } }> {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw httpError(409, 'Email already registered');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
  if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) throw httpError(400, 'Password must include letters and numbers');

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email: email.toLowerCase(), passwordHash, name } });
  const { access, refresh } = await issueTokens(user.id, user.email, user.role as 'user' | 'admin');
  const out = { access, refresh, user: { id: user.id, email: user.email, role: user.role } };
  logger.info({ userId: user.id }, 'user signup');
  return out;
}

export async function login(email: string, password: string): Promise<{ access: string; refresh: string; user: { id: string; email: string; role: string } }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw httpError(401, 'Invalid credentials');
  if (!user.active) throw httpError(403, 'Account deactivated');
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw httpError(401, 'Invalid credentials');
  const { access, refresh } = await issueTokens(user.id, user.email, user.role as 'user' | 'admin');
  return { access, refresh, user: { id: user.id, email: user.email, role: user.role } };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return;
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } }).catch(() => undefined);
}

export async function rotateRefresh(oldToken: string): Promise<{ access: string; refresh: string; sub: string; email: string; role: 'user' | 'admin' }> {
  const payload = verifyRefreshToken(oldToken);
  if (!payload) throw httpError(401, 'Invalid refresh token');
  const tokenHash = hashToken(oldToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw httpError(401, 'Refresh token invalid or expired');
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.active) throw httpError(401, 'Account not found or deactivated');

  // Rotation: revoke old, issue new (detects token reuse — stolen tokens become invalid).
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
  const issued = await issueTokens(user.id, user.email, user.role as 'user' | 'admin');
  return { access: issued.access, refresh: issued.refresh, sub: user.id, email: user.email, role: user.role as 'user' | 'admin' };
}

async function issueTokens(userId: string, email: string, role: 'user' | 'admin', req?: Request): Promise<{ access: string; refresh: string }> {
  const access = signAccessToken({ sub: userId, email, role });
  const refresh = signRefreshToken({ sub: userId, email, role });
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(refresh), expiresAt: new Date(Date.now() + config.jwt.refreshTtlDays * 86400_000), userAgent: req?.headers['user-agent'], ip: req?.ip },
  });
  return { access, refresh };
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw httpError(401, 'Current password incorrect');
  if (next.length < 8 || !/[0-9]/.test(next) || !/[a-zA-Z]/.test(next)) throw httpError(400, 'New password too weak');
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
  await prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
}

export async function updateProfile(userId: string, name?: string | null): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: name === undefined ? {} : { name } });
}

export async function deleteAccount(userId: string): Promise<void> {
  await prisma.user.delete({ where: { id: userId } });
}

export { issueTokens };

function httpError(status: number, message: string): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}


