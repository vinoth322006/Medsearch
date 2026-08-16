// LitSense 2.0 client — cached + globally throttled.
// Never throw on external failure: resolve with a DegradedResult letting the
// caller serve cached results + a clear degraded notice.

import { config } from '../config';
import { cacheGet, cacheSet, cacheKeys, normalizeQuery } from '../cache';
import { GlobalThrottle } from '../cache/globalThrottle';
import { logger } from '../utils/logger';

export interface LitSenseResult {
  text: string;
  score: number;
  pmid: number | null;
  pmcid: string | null;
  section: string;
}

export interface LitSenseResponse {
  ok: boolean;
  source: 'live' | 'cache' | 'degraded';
  degradedMessage?: string;
  results: LitSenseResult[];
  cacheHit: boolean;
  latencyMs: number;
}

const throttle = new GlobalThrottle(config.litsense.minIntervalMs, 'litsense');

export async function searchLitSense(query: string, rerank: boolean): Promise<LitSenseResponse> {
  const start = Date.now();
  const normalized = normalizeQuery(query);
  const key = cacheKeys.search(normalized, rerank);

  // 1) Try cache first — never touches the rate limit budget.
  const cached = await cacheGet<LitSenseResult[]>(key);
  if (cached) {
    return { ok: true, source: 'cache', results: cached, cacheHit: true, latencyMs: Date.now() - start };
  }

  // 2) Live fetch, throttled.
  try {
    await throttle.acquire();
    const url = new URL(config.litsense.baseUrl);
    url.searchParams.set('query', query);
    url.searchParams.set('rerank', String(rerank));

    const controller = new AbortController();
    const to = setTimeout(() => controller.abort(), config.litsense.timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(to);

    if (!res.ok) {
      throw new Error(`LitSense HTTP ${res.status}`);
    }
    const raw = (await res.json()) as unknown;
    const results = sanitizeResults(raw);
    await cacheSet(key, results, config.cache.searchTtlSec);
    return { ok: true, source: 'live', results, cacheHit: false, latencyMs: Date.now() - start };
  } catch (err) {
    logger.warn({ err, query: normalized }, 'LitSense request failed — attempting cached fallback');

    // Graceful fallback: try the cache once more (may have been populated
    // concurrently by another request). If still empty, report degraded.
    const fallback = await cacheGet<LitSenseResult[]>(key);
    if (fallback && fallback.length > 0) {
      return {
        ok: true,
        source: 'degraded',
        degradedMessage: 'Search is temporarily degraded — showing cached results.',
        results: fallback,
        cacheHit: true,
        latencyMs: Date.now() - start,
      };
    }
    return {
      ok: false,
      source: 'degraded',
      degradedMessage: 'Search is temporarily unavailable. Please try again in a moment.',
      results: [],
      cacheHit: false,
      latencyMs: Date.now() - start,
    };
  }
}

function sanitizeResults(raw: unknown): LitSenseResult[] {
  if (!Array.isArray(raw)) return [];
  const out: LitSenseResult[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    out.push({
      text: typeof r.text === 'string' ? r.text : '',
      score: typeof r.score === 'number' ? r.score : 0,
      pmid: typeof r.pmid === 'number' ? r.pmid : null,
      pmcid: typeof r.pmcid === 'string' ? r.pmcid : null,
      section: typeof r.section === 'string' ? r.section : '',
    });
  }
  return out.slice(0, config.litsense.maxResults);
}
