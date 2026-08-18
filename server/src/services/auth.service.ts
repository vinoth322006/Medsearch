import { prisma } from '../db/prisma';
import { hashPassword, verifyPassword } from '../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken, hashToken } from '../utils/tokens';
import { config } from '../config';
import { logger } from '../utils/logger';
import { firebaseAdminAuth } from '../config/firebase-admin';
import type { Request, Response } from 'express';

const REFRESH_COOKIE = 'ms_rt';

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'strict',    // mitigates CSRF on the cookie-based refresh flow
    path: '/api/auth',
    maxAge: config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth', httpOnly: true, sameSite: 'strict', secure: config.cookieSecure });
}

export async function signup(email: string, password: string, name?: string, req?: Request): Promise<{ access: string; refresh: string; user: { id: string; email: string; name?: string | null; role: string } }> {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) throw httpError(409, 'Email already registered');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
  if (!/[0-9]/.test(password) || !/[a-zA-Z]/.test(password)) throw httpError(400, 'Password must include letters and numbers');

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({ data: { email: email.toLowerCase(), passwordHash, name } });
  const { access, refresh } = await issueTokens(user.id, user.email, user.role as 'user' | 'admin', req);
  const out = { access, refresh, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
  logger.info({ userId: user.id }, 'user signup');
  return out;
}

export async function firebaseLogin(idToken: string, req?: Request): Promise<{ access: string; refresh: string; user: { id: string; email: string; name?: string | null; role: string; avatarUrl?: string | null } }> {
  const decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
  const email = decodedToken.email?.toLowerCase();
  
  if (!email) throw httpError(400, 'No email found in Firebase token');
  
  const firebaseUid = decodedToken.uid;
  const name = decodedToken.name || null;
  const avatarUrl = decodedToken.picture || null;
  const emailVerified = decodedToken.email_verified || false;
  
  // Find existing user by email or create new
  let user = await prisma.user.findUnique({ where: { email } });
  
  if (user) {
    if (!user.active) throw httpError(403, 'Account deactivated');
    
    // If they logged in with Google but their account was created via email, link them
    const updates: any = {};
    if (user.authProvider === 'email') updates.authProvider = 'both';
    if (!user.firebaseUid) updates.firebaseUid = firebaseUid;
    if (!user.avatarUrl && avatarUrl) updates.avatarUrl = avatarUrl;
    if (emailVerified && !user.emailVerified) updates.emailVerified = true;
    if (!user.name && name) updates.name = name;
    
    if (Object.keys(updates).length > 0) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: updates
      });
    }
  } else {
    // New Google user
    user = await prisma.user.create({
      data: {
        email,
        name,
        authProvider: 'google',
        firebaseUid,
        avatarUrl,
        emailVerified
      }
    });
  }

  const { access, refresh } = await issueTokens(user.id, user.email, user.role as 'user' | 'admin', req);
  return { access, refresh, user: { id: user.id, email: user.email, name: user.name, role: user.role, avatarUrl: user.avatarUrl } };
}

export async function login(email: string, password: string, req?: Request): Promise<{ access: string; refresh: string; user: { id: string; email: string; name?: string | null; role: string } }> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) throw httpError(401, 'Invalid credentials');
  if (!user.active) throw httpError(403, 'Account deactivated');
  
  if (!user.passwordHash) {
    // This is a Google-only user who hasn't set a password
    throw httpError(401, 'Please sign in with Google');
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw httpError(401, 'Invalid credentials');
  const { access, refresh } = await issueTokens(user.id, user.email, user.role as 'user' | 'admin', req);
  return { access, refresh, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}

export async function logout(refreshToken: string | undefined): Promise<void> {
  if (!refreshToken) return;
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) return;
  const tokenHash = hashToken(refreshToken);
  await prisma.refreshToken.updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } }).catch(() => undefined);
}

export async function rotateRefresh(oldToken: string, req?: Request): Promise<{ access: string; refresh: string; sub: string; email: string; name?: string | null; role: 'user' | 'admin' }> {
  const payload = verifyRefreshToken(oldToken);
  if (!payload) throw httpError(401, 'Invalid refresh token');
  const tokenHash = hashToken(oldToken);
  const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) throw httpError(401, 'Refresh token invalid or expired');
  const user = await prisma.user.findUnique({ where: { id: stored.userId } });
  if (!user || !user.active) throw httpError(401, 'Account not found or deactivated');

  // Rotation: atomically revoke the old token ONLY if it is still un-revoked.
  // The conditional updateMany returns affected-count=0 if a concurrent caller
  // already revoked it (token reuse / replay race) → we treat it as invalid.
  const revoked = await prisma.refreshToken.updateMany({
    where: { id: stored.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (revoked.count === 0) throw httpError(401, 'Refresh token invalid or expired');

  const issued = await issueTokens(user.id, user.email, user.role as 'user' | 'admin', req);
  return { access: issued.access, refresh: issued.refresh, sub: user.id, email: user.email, name: user.name, role: user.role as 'user' | 'admin' };
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
  if (!user.passwordHash) throw httpError(401, 'Please reset password through Google');
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

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  // Always return success (don't leak whether the email exists)
  if (!user) return;

  // Generate a secure random token
  const crypto = await import('crypto');
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Invalidate any existing unused reset tokens for this user
  await prisma.passwordReset.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  await prisma.passwordReset.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  // In production, wire up nodemailer / SES here.
  // For development, log the reset link to the server console.
  const resetUrl = `http://localhost:5173/reset-password?token=${rawToken}`;
  logger.info({ userId: user.id, email: user.email, resetUrl }, '🔑 Password reset link generated');
  console.log(`\n🔑 PASSWORD RESET LINK (dev only):\n   ${resetUrl}\n`);
}

export async function resetPassword(rawToken: string, newPassword: string): Promise<void> {
  const crypto = await import('crypto');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  const record = await prisma.passwordReset.findUnique({ where: { tokenHash } });
  if (!record) throw httpError(400, 'Invalid or expired reset link');
  if (record.usedAt) throw httpError(400, 'This reset link has already been used');
  if (record.expiresAt < new Date()) throw httpError(400, 'This reset link has expired');

  if (newPassword.length < 8 || !/[0-9]/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
    throw httpError(400, 'Password must be at least 8 characters with letters and numbers');
  }

  // Mark token as used
  await prisma.passwordReset.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  // Update password and revoke all refresh tokens
  await prisma.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await prisma.refreshToken.updateMany({ where: { userId: record.userId }, data: { revokedAt: new Date() } });

  logger.info({ userId: record.userId }, 'password reset completed');
}

export { issueTokens };

function httpError(status: number, message: string): Error & { status: number } {
  const e = new Error(message) as Error & { status: number };
  e.status = status;
  return e;
}
