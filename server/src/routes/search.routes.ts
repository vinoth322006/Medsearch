import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { optionalAuth, authRequired } from '../middleware/auth';
import { anonSearchLimiter, authedSearchLimiter } from '../middleware/rateLimit';
import { runSearch } from '../services/search.service';
import { prisma } from '../db/prisma';
import { redis } from '../cache';

const router = Router();

const searchSchema = z.object({ query: z.string().min(3).max(2000), rerank: z.boolean().optional().default(true) });

router.post('/search', optionalAuth, anonSearchLimiter, authedSearchLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = searchSchema.parse(req.body);
    const out = await runSearch({ query: parsed.query, rerank: parsed.rerank, userId: req.user?.sub ?? null, ip: req.ip ?? null });
    res.json({
      results: out.results.map((r) => ({
        text: r.text,
        score: r.score,
        pmid: r.pmid,
        pmcid: r.pmcid,
        section: r.section,
        meta: r.meta ?? null,
      })),
      source: out.source,
      degradedMessage: out.degradedMessage,
      cacheHit: out.cacheHit,
      latencyMs: out.latencyMs,
      resultCount: out.resultCount,
    });
  } catch (e) { next(e); }
});

router.get('/health', async (_req, res, next) => {
  try {
    // Deep healthcheck: confirm Postgres + Redis are reachable.
    const [pg, cache] = await Promise.all([
      prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
      redis.ping().then((r) => r === 'PONG').catch(() => false),
    ]);
    const ok = pg && cache;
    res.status(ok ? 200 : 503).json({ ok, ts: Date.now(), checks: { postgres: pg, redis: cache } });
  } catch (e) { next(e); }
});

export { authRequired };
export default router;
