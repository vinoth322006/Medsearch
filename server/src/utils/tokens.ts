import jwt from 'jsonwebtoken';
import { config } from '../config';
import crypto from 'crypto';

export interface AccessPayload {
  sub: string;
  role: 'user' | 'admin';
  email: string;
}

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, { expiresIn: config.jwt.accessTtl as unknown as number });
}

export function verifyAccessToken(token: string): AccessPayload | null {
  try {
    return jwt.verify(token, config.jwt.accessSecret) as AccessPayload;
  } catch {
    return null;
  }
}

export const signRefreshToken = signRefresh;
export const verifyRefreshToken = verifyRefresh;

export function signRefresh(payload: AccessPayload): string {
  // jti (random per-token id) guarantees distinct signatures even when two
  // refresh tokens are issued in the same second (avoids tokenHash collisions
  // on the unique RefreshToken.tokenHash column during rapid rotations).
  return jwt.sign({ ...payload, jti: crypto.randomUUID() }, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshTtlDays * 86400 });
}

export function verifyRefresh(token: string): AccessPayload | null {
  try {
    return jwt.verify(token, config.jwt.refreshSecret) as AccessPayload;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
