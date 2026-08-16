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
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshTtlDays * 86400 });
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
