// NCBI E-utilities esummary client — batched (<=200 PMIDs/call), globally
// throttled (3/sec without API key, 10/sec with), cached long-term in DB +
// Redis (article metadata does not change).

import { config } from '../config';
import { cacheGet, cacheSet } from '../cache';
import { GlobalThrottle } from '../cache/globalThrottle';
import { logger } from '../utils/logger';
import { prisma } from '../db/prisma';

export interface ArticleMeta {
  pmid: number;
  pmcid: string | null;
  title: string | null;
  authors: string[];
  journal: string | null;
  pubDate: string | null;
}

const interval = config.eutils.apiKey
  ? Math.max(100, config.eutils.minIntervalMs)
  : Math.max(334, config.eutils.minIntervalMs);
const throttle = new GlobalThrottle(interval, 'eutils');

export async function fetchArticleMeta(pmids: number[]): Promise<Record<number, ArticleMeta>> {
  const out: Record<number, ArticleMeta> = {};
  const unique = [...new Set(pmids)].filter((p) => p > 0);
  if (unique.length === 0) return out;

  // 1) Resolve from DB (permanent store) first.
  const fromDb = await prisma.articleMeta.findMany({ where: { pmid: { in: unique } } });
  const stillNeeded: number[] = [];
  for (const pmid of unique) {
    const row = fromDb.find((r) => r.pmid === pmid);
    if (row) {
      out[pmid] = {
        pmid: row.pmid,
        pmcid: row.pmcid,
        title: row.title,
        authors: row.authors,
        journal: row.journal,
        pubDate: row.pubDate,
      };
    } else {
      stillNeeded.push(pmid);
    }
  }

  // 2) For any not in DB, call esummary in batches of <=200, throttled.
  // 3) Store permanently in DB + Redis (long TTL redundant but warm).
  for (let i = 0; i < stillNeeded.length; i += config.eutils.batchSize) {
    const batch = stillNeeded.slice(i, i + config.eutils.batchSize);
    const rest = await fetchBatch(batch);
    for (const [pmidStr, meta] of Object.entries(rest)) {
      const pmid = parseInt(pmidStr, 10);
      out[pmid] = meta;
    }
  }
  return out;
}

async function fetchBatch(batch: number[]): Promise<Record<string, ArticleMeta>> {
  if (batch.length === 0) return {};
  const key = `meta:batch:${batch.sort((a, b) => a - b).join(',')}`;
  const cached = await cacheGet<Record<string, ArticleMeta>>(key);
  if (cached) return cached;

  try {
    await throttle.acquire();
    const url = new URL(config.eutils.baseUrl + 'esummary.fcgi');
    url.searchParams.set('db', 'pubmed');
    url.searchParams.set('id', batch.join(','));
    url.searchParams.set('retmode', 'json');
    if (config.eutils.apiKey) url.searchParams.set('api_key', config.eutils.apiKey);

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), config.eutils.timeoutMs);
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    clearTimeout(to);
    if (!res.ok) throw new Error(`esummary HTTP ${res.status}`);

    const raw = (await res.json()) as Record<string, unknown>;
    const result = (raw.result ?? {}) as Record<string, unknown>;
    delete result.uids;
    const out: Record<string, ArticleMeta> = {};

    for (const [uid, val] of Object.entries(result)) {
      if (!val || typeof val !== 'object') continue;
      const a = val as Record<string, unknown>;
      const authors = Array.isArray(a.authors)
        ? (a.authors as Array<Record<string, unknown>>).map((x) => String(x.name ?? '')).filter(Boolean)
        : [];
      const pmid = parseInt(uid, 10);
      out[uid] = {
        pmid,
        pmcid: extractPmcid(a),
        title: typeof a.title === 'string' ? a.title : null,
        authors,
        journal: typeof a.fulljournalname === 'string' ? a.fulljournalname : typeof a.source === 'string' ? a.source : null,
        pubDate: typeof a.pubdate === 'string' ? a.pubdate : null,
      };
    }

    await cacheSet(key, out, config.cache.metaTtlSec);
    await persistBatch(out);
    return out;
  } catch (err) {
    logger.warn({ err, batch }, 'esummary fetch failed — metadata unavailable this round');
    return {};
  }
}

// esummary of a pubmed record carries articleids; the pmcid, if available,
// appears as an entry whose idtype === 'pmc' or 'pmcid'.
function extractPmcid(a: Record<string, unknown>): string | null {
  const ids = a.articleids;
  if (!Array.isArray(ids)) return null;
  for (const entry of ids as Array<Record<string, unknown>>) {
    const t = String(entry.idtype ?? '').toLowerCase();
    if (t === 'pmcid' || t === 'pmc') {
      const v = String(entry.value ?? '').trim();
      if (v) return v.startsWith('PMC') ? v : `PMC${v}`;
    }
  }
  return null;
}

async function persistBatch(meta: Record<string, ArticleMeta>): Promise<void> {
  const rows = Object.values(meta);
  if (rows.length === 0) return;
  for (const m of rows) {
    try {
      await prisma.articleMeta.upsert({
        where: { pmid: m.pmid },
        create: {
          pmid: m.pmid,
          pmcid: m.pmcid,
          title: m.title,
          authors: m.authors,
          journal: m.journal,
          pubDate: m.pubDate,
          rawJson: m as unknown as object,
        },
        update: {},
      });
    } catch (err) {
      logger.warn({ err, pmid: m.pmid }, 'failed persisting article meta (non-fatal)');
    }
  }
}

