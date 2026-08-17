import { prisma } from '../db/prisma';
import { searchSemanticEngine, SemanticEngineResult } from '../external/semanticEngine';
import { fetchArticleMeta, ArticleMeta } from '../external/eutils';
import { logger } from '../utils/logger';
import { config } from '../config';

export interface SearchResultItem extends SemanticEngineResult {
  meta?: ArticleMeta | null;
}

export interface SearchOutcome {
  results: SearchResultItem[];
  source: 'live' | 'cache' | 'degraded';
  degradedMessage?: string;
  cacheHit: boolean;
  latencyMs: number;
  resultCount: number;
}

export async function runSearch(opts: {
  query: string;
  rerank: boolean;
  userId: string | null;
  ip: string | null;
}): Promise<SearchOutcome> {
  const { query, rerank, userId, ip } = opts;
  const ls = await searchSemanticEngine(query, rerank);

  // Enrich with article metadata (only for results that have PMIDs)
  const pmids = ls.results.map((r) => r.pmid).filter((p): p is number => p !== null);
  let meta: Record<number, ArticleMeta> = {};
  if (pmids.length > 0) {
    try {
      meta = await fetchArticleMeta(pmids);
    } catch (err) {
      logger.warn({ err }, 'metadata enrichment failed (non-fatal)');
    }
  }

  const enriched: SearchResultItem[] = ls.results.map((r) => ({
    text: r.text,
    score: r.score,
    pmid: r.pmid,
    pmcid: r.pmcid,
    section: r.section,
    meta: r.pmid ? meta[r.pmid] ?? null : null,
  }));

  // Record history (logged-in users only) + aggregate analytics (everyone).
  if (userId) {
    try {
      // Deduplicate: if same query already in history, update timestamp + count
      const normalizedQuery = query.trim();
      const existing = await prisma.searchHistory.findFirst({
        where: { userId, query: normalizedQuery },
      });
      if (existing) {
        await prisma.searchHistory.update({
          where: { id: existing.id },
          data: { resultCount: enriched.length, source: ls.source, createdAt: new Date() },
        });
      } else {
        await prisma.searchHistory.create({
          data: { userId, query: normalizedQuery, resultCount: enriched.length, source: ls.source },
        });
      }
    } catch (err) {
      logger.warn({ err }, 'failed recording search history');
    }
  }

  try {
    await prisma.searchEvent.create({
      data: {
        userId: userId ?? null,
        anonymous: !userId,
        isAuthed: Boolean(userId),
        queryLength: query.length, // length only, no raw text in anonymous row
        source: ls.source,
        resultCount: enriched.length,
        latencyMs: ls.latencyMs,
      },
    });
  } catch (err) {
    logger.warn({ err }, 'failed recording search event');
  }

  void ip;
  return {
    results: enriched,
    source: ls.source,
    degradedMessage: ls.degradedMessage,
    cacheHit: ls.cacheHit,
    latencyMs: ls.latencyMs,
    resultCount: enriched.length,
  };
}

void config;
