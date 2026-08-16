import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/tokens';
import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import type { AccessPayload } from '../utils/tokens';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AccessPayload & { active?: boolean };
    }
  }
}

export async function authRequired(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = header.slice(7);
  const payload = verifyAccessToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, active: true, email: true } });
  if (!user || !user.active) {
    res.status(401).json({ error: 'Account not found or deactivated' });
    return;
  }
  req.user = { sub: user.id, email: user.email, role: user.role, active: user.active };
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } }).catch(() => undefined);
  next();
}

export async function adminRequired(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const token = header.slice(7);
    const payload = verifyAccessToken(token);
    if (payload) {
      const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, active: true, email: true } });
      if (user && user.active) {
        req.user = { sub: user.id, email: user.email, role: user.role, active: user.active };
      }
    }
  }
  next();
}

export function requireRole(role: 'user' | 'admin') {
  return role === 'admin' ? adminRequired : authRequired;
}

export { logger };
