import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { login, signup, logout, rotateRefresh, changePassword, updateProfile, deleteAccount, setRefreshCookie, clearRefreshCookie } from '../services/auth.service';
import { checkLoginLockout, logRateLimitHit } from '../middleware/rateLimit';
import { authRequired } from '../middleware/auth';

const router = Router();
const REFRESH_COOKIE = 'ms_rt';

const signupSchema = z.object({ email: z.string().email(), password: z.string().min(8), name: z.string().optional() });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const changePwSchema = z.object({ currentPassword: z.string(), newPassword: z.string().min(8) });
const profileSchema = z.object({ name: z.string().nullable().optional() });

router.post('/signup', async (req, res, next) => {
  try {
    const parsed = signupSchema.parse(req.body);
    const out = await signup(parsed.email, parsed.password, parsed.name);
    setRefreshCookie(res, out.refresh);
    res.status(201).json({ accessToken: out.access, user: out.user });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const parsed = loginSchema.parse(req.body);
    const key = (parsed.email.toLowerCase()) + '|' + (req.ip ?? '');
    const lock = await checkLoginLockout(key);
    if (lock.blocked) {
      logRateLimitHit('login', parsed.email);
      res.status(429).json({ error: `Too many failed attempts. Try again in ${Math.ceil((lock.msBeforeNext ?? 0) / 1000)}s.` });
      return;
    }
    const out = await login(parsed.email, parsed.password);
    setRefreshCookie(res, out.refresh);
    res.json({ accessToken: out.access, user: out.user });
  } catch (e) {
    next(e);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    await logout(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) { res.status(401).json({ error: 'No refresh token' }); return; }
    const out = await rotateRefresh(token);
    setRefreshCookie(res, out.refresh);
    res.json({ accessToken: out.access, user: { id: out.sub, email: out.email, role: out.role } });
  } catch (e) { next(e); }
});

router.get('/me', authRequired, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.sub }, select: { id: true, email: true, name: true, role: true, createdAt: true } });
    res.json({ user });
  } catch (e) { next(e); }
});

router.post('/password', authRequired, async (req, res, next) => {
  try {
    const parsed = changePwSchema.parse(req.body);
    await changePassword(req.user!.sub, parsed.currentPassword, parsed.newPassword);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.patch('/profile', authRequired, async (req, res, next) => {
  try {
    const parsed = profileSchema.parse(req.body);
    await updateProfile(req.user!.sub, parsed.name);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/account', authRequired, async (req, res, next) => {
  try {
    await deleteAccount(req.user!.sub);
    clearRefreshCookie(res);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;


