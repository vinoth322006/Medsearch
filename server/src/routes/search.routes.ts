import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { optionalAuth, authRequired } from '../middleware/auth';
import { anonSearchLimiter, authedSearchLimiter } from '../middleware/rateLimit';
import { runSearch } from '../services/search.service';

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

router.get('/health', (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

export { authRequired };
export default router;
