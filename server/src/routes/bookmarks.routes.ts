import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma';
import { authRequired } from '../middleware/auth';

const router = Router();

const createSchema = z.object({
  query: z.string().min(3).max(2000),
  resultText: z.string().min(1),
  score: z.number(),
  pmid: z.number().nullable().optional(),
  pmcid: z.string().nullable().optional(),
  section: z.string().optional(),
  folder: z.string().optional(),
  tags: z.array(z.string()).optional(),
  articleTitle: z.string().nullable().optional(),
  articleAuthors: z.array(z.string()).optional(),
  articleJournal: z.string().nullable().optional(),
  articlePubDate: z.string().nullable().optional(),
});

router.get('/', authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookmarks = await prisma.bookmark.findMany({
      where: { userId: req.user!.sub },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ bookmarks });
  } catch (e) { next(e); }
});

router.post('/', authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = createSchema.parse(req.body);
    const created = await prisma.bookmark.create({
      data: {
        userId: req.user!.sub,
        query: parsed.query,
        resultText: parsed.resultText,
        score: parsed.score,
        pmid: parsed.pmid ?? null,
        pmcid: parsed.pmcid ?? null,
        section: parsed.section,
        folder: parsed.folder,
        tags: parsed.tags ?? [],
        articleTitle: parsed.articleTitle ?? null,
        articleAuthors: parsed.articleAuthors ?? [],
        articleJournal: parsed.articleJournal ?? null,
        articlePubDate: parsed.articlePubDate ?? null,
      },
    });
    res.status(201).json({ bookmark: created });
  } catch (e) { next(e); }
});

router.delete('/:id', authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.bookmark.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Bookmark not found' });
      return;
    }
    await prisma.bookmark.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

router.patch('/:id', authRequired, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const patchSchema = z.object({ folder: z.string().optional(), tags: z.array(z.string()).optional() });
    const parsed = patchSchema.parse(req.body);
    const existing = await prisma.bookmark.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.user!.sub) {
      res.status(404).json({ error: 'Bookmark not found' });
      return;
    }
    const updated = await prisma.bookmark.update({ where: { id: req.params.id }, data: { folder: parsed.folder, tags: parsed.tags ?? existing.tags } });
    res.json({ bookmark: updated });
  } catch (e) { next(e); }
});

export default router;
