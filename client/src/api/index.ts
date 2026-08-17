const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:4000';

let accessToken: string | null = null;
let onAuthFailure: (() => void) | null = null;

export function setAccessToken(t: string | null): void { accessToken = t; }
export function getAccessToken(): string | null { return accessToken; }
export function setAuthFailureHandler(fn: () => void): void { onAuthFailure = fn; }

async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
    if (!res.ok) return null;
    const data = (await res.json()) as { accessToken: string };
    accessToken = data.accessToken;
    return data.accessToken;
  } catch {
    return null;
  }
}

export interface ApiError { status: number; message: string; data?: unknown }

async function request<T>(method: string, path: string, body?: unknown, opts?: { allowRetry?: boolean }): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`${BASE}${path}`, { method, headers, credentials: 'include', body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  // 401 -> attempt silent refresh + retry once
  if (res.status === 401 && (!opts || opts.allowRetry !== false) && method !== 'GET') {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(method, path, body, { allowRetry: false });
  }
  if (res.status === 401 && method === 'GET') {
    if (!accessToken) { onAuthFailure?.(); }
  }

  if (!res.ok) {
    const err: ApiError = { status: res.status, message: (data as { error?: string })?.error ?? 'Request failed', data };
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(p: string) => request<T>('GET', p),
  post: <T>(p: string, b?: unknown) => request<T>('POST', p, b),
  patch: <T>(p: string, b?: unknown) => request<T>('PATCH', p, b),
  del: <T>(p: string) => request<T>('DELETE', p),

  auth: {
    signup: (b: { email: string; password: string; name?: string }) => api.post<{ accessToken: string; user: User }>('/api/auth/signup', b),
    login: (b: { email: string; password: string }) => api.post<{ accessToken: string; user: User }>('/api/auth/login', b),
    logout: () => api.post('/api/auth/logout'),
    me: () => api.get<{ user: User }>('/api/auth/me'),
    changePassword: (b: { currentPassword: string; newPassword: string }) => api.post('/api/auth/password', b),
    updateProfile: (b: { name?: string | null }) => api.patch('/api/auth/profile', b),
    deleteAccount: () => api.del('/api/auth/account'),
    forgotPassword: (email: string) => api.post<{ ok: boolean }>('/api/auth/forgot-password', { email }),
    resetPassword: (token: string, password: string) => api.post<{ ok: boolean }>('/api/auth/reset-password', { token, password }),
  },
  search: (b: { query: string; rerank?: boolean }) => api.post<SearchResponse>('/api/search', b),
  bookmarks: {
    list: () => api.get<{ bookmarks: Bookmark[] }>('/api/bookmarks'),
    create: (b: BookmarkInput) => api.post<{ bookmark: Bookmark }>('/api/bookmarks', b),
    remove: (id: string) => api.del(`/api/bookmarks/${id}`),
    clear: () => api.del('/api/bookmarks'),
    update: (id: string, b: { folder?: string; tags?: string[] }) => api.patch<{ bookmark: Bookmark }>(`/api/bookmarks/${id}`, b),
  },
  history: {
    list: (limit?: number) => api.get<{ history: SearchHistoryItem[] }>(`/api/history?limit=${limit ?? 200}`),
    clear: () => api.del('/api/history'),
    remove: (id: string) => api.del(`/api/history/${id}`),
  },
  admin: {
    users: () => api.get<{ users: AdminUser[] }>('/api/admin/users'),
    setUserActive: (id: string, active: boolean) => api.patch(`/api/admin/users/${id}`, { active }),
    setUserRole: (id: string, role: 'user' | 'admin') => api.patch<{ user: Pick<AdminUser, 'id' | 'role'> }>(`/api/admin/users/${id}`, { role }),
    deleteUser: (id: string) => api.del<{ success: boolean }>(`/api/admin/users/${id}`),
    userActivity: (id: string) => api.get<{ summary: { searchCount: number; bookmarkCount: number; lastSearchAt: string | null }; rawQueriesVisible: boolean; recentQueries: { query: string; createdAt: string }[] }>(`/api/admin/users/${id}/activity`),
    analytics: () => api.get<AnalyticsOverview>('/api/admin/analytics/overview'),
    topTerms: (limit?: number) => api.get<{ topTerms: { term: string; count: number }[]; source: string; attributed: boolean }>(`/api/admin/analytics/top-terms?limit=${limit ?? 50}`),
  },
};

export interface User { id: string; email: string; name?: string | null; role: 'user' | 'admin'; createdAt?: string }
export interface ArticleMeta { pmid: number; pmcid: string | null; title: string | null; authors: string[]; journal: string | null; pubDate: string | null; pubType: string[]; lang: string }
export interface SearchResultItem { text: string; score: number; pmid: number | null; pmcid: string | null; section: string; meta?: ArticleMeta | null }
export interface SearchResponse { results: SearchResultItem[]; source: 'live' | 'cache' | 'degraded'; degradedMessage?: string; cacheHit: boolean; latencyMs: number; resultCount: number }
export interface Bookmark { id: string; userId: string; query: string; resultText: string; score: number; pmid: number | null; pmcid: string | null; section?: string | null; folder?: string | null; tags: string[]; createdAt: string; articleTitle?: string | null; articleAuthors?: string[]; articleJournal?: string | null; articlePubDate?: string | null }
export interface BookmarkInput { query: string; resultText: string; score: number; pmid?: number | null; pmcid?: string | null; section?: string; folder?: string; tags?: string[]; articleTitle?: string | null; articleAuthors?: string[]; articleJournal?: string | null; articlePubDate?: string | null }
export interface SearchHistoryItem { id: string; query: string; resultCount: number; source: string; createdAt: string }
export interface AdminUser { id: string; email: string; name?: string | null; role: 'user' | 'admin'; active: boolean; createdAt: string; lastActiveAt: string | null; _count: { bookmarks: number; searches: number } }
export interface AnalyticsOverview {
  totals: { totalSearches: number; searches7d: number; searches1d: number; anonSearches: number; authedSearches: number; totalUsers: number; activeUsers7d: number; activeUsers30d: number }
  health: { semanticEngineSuccessRate: number; cacheHitRate: number; avgLatencyMs: number; degraded: number; cacheHits: number }
  dailyTrend: { day: string; count: number }[]
}
