import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma';
import { authRequired } from '../middleware/auth';

const router = Router();

router.get('/', authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '200'), 10) || 200, 500);
    const history = await prisma.searchHistory.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ history });
  } catch (e) { next(e); }
});

router.delete('/', authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.searchHistory.deleteMany({ where: { userId: req.user!.sub } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.delete('/:id', authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.searchHistory.deleteMany({ where: { id: req.params.id, userId: req.user!.sub } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

export default router;
