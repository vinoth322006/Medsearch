import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { authRequired, adminRequired } from '../middleware/auth';
import { config } from '../config';
import { logger } from '../utils/logger';

const router = Router();
router.use(authRequired, adminRequired);

// ---- User management ----
// NOTE privacy default: admins see only basic account info (email, signup date,
// last active). Never bookmark contents or raw search query text unless
// ADMIN_CAN_VIEW_USER_QUERIES=true is set by the client explicitly.
router.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '100'), 10) || 100, 500);
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, lastActiveAt: true, _count: { select: { bookmarks: true, searches: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ users });
  } catch (e) { next(e); }
});

router.patch('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as { active?: boolean };
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) { res.status(404).json({ error: 'User not found' }); return; }
    if (target.id === req.user!.sub && body.active === false) {
      res.status(400).json({ error: 'You cannot deactivate your own admin account' });
      return;
    }
    const updated = await prisma.user.update({ where: { id: req.params.id }, data: { active: body.active } });
    logger.info({ admin: req.user!.sub, target: req.params.id, active: body.active }, 'admin updated user active state');
    res.json({ user: { id: updated.id, active: updated.active } });
  } catch (e) { next(e); }
});

// Per-user activity summary — ALREADY aggregate-only by default. Raw queries
// gated behind ADMIN_CAN_VIEW_USER_QUERIES.
router.get('/users/:id/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) { res.status(404).json({ error: 'User not found' }); return; }

    const [searchCount, bookmarkCount, lastSearch] = await Promise.all([
      prisma.searchHistory.count({ where: { userId: req.params.id } }),
      prisma.bookmark.count({ where: { userId: req.params.id } }),
      prisma.searchHistory.findFirst({ where: { userId: req.params.id }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);

    let recentQueries: { query: string; createdAt: Date }[] = [];
    if (config.adminCanViewUserQueries) {
      recentQueries = await prisma.searchHistory.findMany({
        where: { userId: req.params.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { query: true, createdAt: true },
      });
    }

    res.json({
      summary: { searchCount, bookmarkCount, lastSearchAt: lastSearch?.createdAt ?? null },
      rawQueriesVisible: config.adminCanViewUserQueries,
      recentQueries: config.adminCanViewUserQueries ? recentQueries : [],
    });
  } catch (e) { next(e); }
});

// ---- Analytics dashboard ----
router.get('/analytics/overview', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const since7 = new Date(Date.now() - 7 * 86400_000);
    const since30 = new Date(Date.now() - 30 * 86400_000);
    const since1 = new Date(Date.now() - 1 * 86400_000);

    const [totalSearches, searches7d, searches1d, anonSearches, authedSearches, cacheHits, degraded, totalUsers, activeUsers7d, activeUsers30d, totalLatency, totalLatencyCount] = await Promise.all([
      prisma.searchEvent.count(),
      prisma.searchEvent.count({ where: { createdAt: { gte: since7 } } }),
      prisma.searchEvent.count({ where: { createdAt: { gte: since1 } } }),
      prisma.searchEvent.count({ where: { anonymous: true } }),
      prisma.searchEvent.count({ where: { isAuthed: true } }),
      prisma.searchEvent.count({ where: { source: 'cache' } }),
      prisma.searchEvent.count({ where: { source: 'degraded' } }),
      prisma.user.count(),
      prisma.user.count({ where: { lastActiveAt: { gte: since7 } } }),
      prisma.user.count({ where: { lastActiveAt: { gte: since30 } } }),
      prisma.searchEvent.aggregate({ _sum: { latencyMs: true } }),
      prisma.searchEvent.count(),
    ]);

    const litSenseSuccessRate = totalLatencyCount > 0 ? (totalLatencyCount - degraded) / totalLatencyCount : 1;
    const cacheHitRate = totalLatencyCount > 0 ? cacheHits / totalLatencyCount : 0;
    const avgLatencyMs = totalLatencyCount > 0 ? Math.round((totalLatency._sum.latencyMs ?? 0) / totalLatencyCount) : 0;

    // Daily trends (last 30 days)
    const daily = await prisma.searchEvent.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
    }).catch(() => []);

    // Aggregate daily counts (groupBy on createdAt is per-timestamp; bucket to day).
    const dailyBucket: Record<string, number> = {};
    for (const row of daily as Array<{ createdAt: Date; _count: { _all: number } }>) {
      const day = row.createdAt.toISOString().slice(0, 10);
      dailyBucket[day] = (dailyBucket[day] ?? 0) + row._count._all;
    }
    const dailyTrend = Object.entries(dailyBucket).map(([day, count]) => ({ day, count })).sort((a, b) => a.day.localeCompare(b.day));

    res.json({
      totals: {
        totalSearches,
        searches7d,
        searches1d,
        anonSearches,
        authedSearches,
        totalUsers,
        activeUsers7d,
        activeUsers30d,
      },
      health: {
        litSenseSuccessRate: Number(litSenseSuccessRate.toFixed(4)),
        cacheHitRate: Number(cacheHitRate.toFixed(4)),
        avgLatencyMs,
        degraded,
        cacheHits,
      },
      dailyTrend,
    });
  } catch (e) { next(e); }
});

// Most common query themes (aggregated, anonymized). Computed from search
// history table (logged-in users only, since anonymous never stores raw text by design).
// Returns top-N frequent tokens in queries, NOT attributed to users.
router.get('/analytics/top-terms', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const since = new Date(Date.now() - 30 * 86400_000);
    const rows = await prisma.searchHistory.findMany({ where: { createdAt: { gte: since } }, select: { query: true } });

    const stop = new Set(['the', 'a', 'an', 'of', 'in', 'and', 'to', 'for', 'with', 'on', 'is', 'are', 'by', 'that', 'this', 'from', 'as', 'at', 'it', 'or']);
    const counts: Record<string, number> = {};
    for (const r of rows) {
      const tokens = r.query.toLowerCase().match(/[a-z][a-z0-9-]{2,}/g) ?? [];
      for (const t of tokens) {
        if (stop.has(t)) continue;
        counts[t] = (counts[t] ?? 0) + 1;
      }
    }
    const top = Object.entries(counts).map(([term, count]) => ({ term, count })).sort((a, b) => b.count - a.count).slice(0, limit);
    res.json({ topTerms: top, source: 'aggregated', attributed: false });
  } catch (e) { next(e); }
});

export default router;
