import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { extractHtml } from './extract.mjs';

const TRACKING = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|ref|source)$/i;
export function canonicalizeUrl(value) {
  const url = new URL(String(value));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Unsupported URL protocol: ${url.protocol}`);
  url.hash = '';
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  const entries = [...url.searchParams.entries()].filter(([key]) => !TRACKING.test(key)).sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey) || aValue.localeCompare(bValue));
  url.search = '';
  for (const [key, val] of entries) url.searchParams.append(key, val);
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function maxAge(headers, fallbackMs) {
  const match = String(headers['cache-control'] ?? '').match(/(?:^|,)\s*max-age=(\d+)/i);
  return match ? Number(match[1]) * 1000 : fallbackMs;
}
function headersObject(headers) { return Object.fromEntries([...headers.entries()].map(([key, value]) => [key.toLowerCase(), value])); }
function domainOf(url) { return new URL(url).hostname.toLowerCase(); }
function parseRobots(text) {
  const groups = []; let agents = []; let rules = [];
  const flush = () => { if (agents.length) groups.push({ agents, rules }); agents = []; rules = []; };
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim(); if (!line) continue;
    const [rawKey, ...rest] = line.split(':'); const key = rawKey.toLowerCase().trim(); const value = rest.join(':').trim();
    if (key === 'user-agent') { if (rules.length) flush(); agents.push(value.toLowerCase()); }
    else if (key === 'disallow' || key === 'allow') rules.push({ type: key, path: value });
  }
  flush();
  return groups;
}
function robotsAllowed(groups, pathname, userAgent) {
  const ua = userAgent.toLowerCase();
  const applicable = groups.filter((group) => group.agents.some((agent) => agent === '*' || ua.includes(agent)));
  let decision = true; let longest = -1;
  for (const group of applicable) for (const rule of group.rules) {
    if (!rule.path || !pathname.startsWith(rule.path)) continue;
    if (rule.path.length > longest || (rule.path.length === longest && rule.type === 'allow')) { longest = rule.path.length; decision = rule.type === 'allow'; }
  }
  return decision;
}

export class WebIntelligence {
  constructor({ cache, searchProviders = [], fetchImpl = fetch, userAgent = 'ForgeStudioBot/0.1', respectRobots = true, defaultTtlMs = 10 * 60_000 } = {}) {
    if (!cache) throw new TypeError('cache is required');
    this.cache = cache; this.searchProviders = [...searchProviders]; this.fetchImpl = fetchImpl; this.userAgent = userAgent; this.respectRobots = respectRobots; this.defaultTtlMs = defaultTtlMs; this.robots = new Map();
  }

  async #assertRobots(url, signal) {
    if (!this.respectRobots) return;
    const target = new URL(url); const origin = target.origin;
    let groups = this.robots.get(origin);
    if (!groups) {
      try {
        const response = await this.fetchImpl(`${origin}/robots.txt`, { headers: { 'user-agent': this.userAgent }, signal });
        groups = response.ok ? parseRobots(await response.text()) : [];
      } catch { groups = []; }
      this.robots.set(origin, groups);
    }
    if (!robotsAllowed(groups, target.pathname, this.userAgent)) throw new Error(`Fetch blocked by robots.txt: ${target.pathname}`);
  }

  async fetch(value, { maxBytes = 2_000_000, signal = null } = {}) {
    const url = canonicalizeUrl(value);
    await this.#assertRobots(url, signal);
    const now = Date.now(); const cached = this.cache.get(url);
    if (cached && cached.expiresAt > now) return this.#decode(cached, true);
    const conditional = {};
    if (cached?.etag) conditional['if-none-match'] = cached.etag;
    if (cached?.lastModified) conditional['if-modified-since'] = cached.lastModified;
    const response = await this.fetchImpl(url, { headers: { 'user-agent': this.userAgent, accept: 'text/html,text/plain,application/json;q=0.8,*/*;q=0.2', ...conditional }, signal, redirect: 'follow' });
    if (response.status === 304 && cached) {
      const headers = { ...cached.headers, ...headersObject(response.headers) };
      const entry = this.cache.put({ ...cached, headers, fetchedAt: now, expiresAt: now + maxAge(headers, this.defaultTtlMs) });
      return this.#decode(entry, true);
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} fetching ${url}`);
    const declared = Number(response.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new Error(`Response exceeds ${maxBytes} bytes`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > maxBytes) throw new Error(`Response exceeds ${maxBytes} bytes`);
    const headers = headersObject(response.headers);
    const contentSha256 = canonicalSha256(body.toString('base64'));
    const entry = this.cache.put({ url, status: response.status, headers, body, contentSha256, fetchedAt: now, expiresAt: now + maxAge(headers, this.defaultTtlMs), etag: headers.etag, lastModified: headers['last-modified'] });
    return this.#decode(entry, false, response.url || url);
  }

  #decode(entry, cacheHit, finalUrl = entry.url) {
    const contentType = String(entry.headers['content-type'] ?? ''); const raw = entry.body.toString('utf8');
    if (/html/i.test(contentType) || /<html|<main|<article/i.test(raw)) {
      const extracted = extractHtml(raw, finalUrl);
      return Object.freeze({ requestedUrl: entry.url, finalUrl, canonicalUrl: canonicalizeUrl(extracted.canonicalUrl), domain: domainOf(extracted.canonicalUrl), title: extracted.title, text: extracted.text, contentSha256: extracted.contentSha256, fetchedAt: new Date(entry.fetchedAt).toISOString(), cacheHit, warnings: extracted.warnings });
    }
    return Object.freeze({ requestedUrl: entry.url, finalUrl, canonicalUrl: canonicalizeUrl(finalUrl), domain: domainOf(finalUrl), title: '', text: raw, contentSha256: canonicalSha256(raw), fetchedAt: new Date(entry.fetchedAt).toISOString(), cacheHit, warnings: Object.freeze([]) });
  }

  async search({ query, limit = 20, signal = null } = {}) {
    const results = [];
    for (const provider of this.searchProviders) {
      const items = await provider.search({ query, limit, signal });
      for (const item of items ?? []) {
        try { results.push({ ...item, providerId: provider.id, canonicalUrl: canonicalizeUrl(item.url), domain: domainOf(item.url), score: Number(item.score ?? 0) }); }
        catch {}
      }
    }
    return results.sort((a, b) => b.score - a.score || String(b.publishedAt ?? '').localeCompare(String(a.publishedAt ?? '')) || a.canonicalUrl.localeCompare(b.canonicalUrl)).slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));
  }

  async research({ query, maxSources = 5, maxFetchBytes = 500_000, signal = null } = {}) {
    const candidates = await this.search({ query, limit: Math.max(maxSources * 4, 10), signal });
    const omissions = []; const unique = []; const seen = new Set();
    for (const item of candidates) {
      if (seen.has(item.canonicalUrl)) { omissions.push({ url: item.url, reason: 'duplicate-url' }); continue; }
      seen.add(item.canonicalUrl); unique.push(item);
    }
    const selected = []; const usedDomains = new Set();
    for (const item of unique) if (!usedDomains.has(item.domain) && selected.length < maxSources) { selected.push(item); usedDomains.add(item.domain); }
    for (const item of unique) if (!selected.includes(item) && selected.length < maxSources) selected.push(item);
    for (const item of unique) if (!selected.includes(item)) omissions.push({ url: item.url, reason: 'source-limit' });
    const sources = [];
    for (const item of selected) {
      try { const page = await this.fetch(item.canonicalUrl, { maxBytes: maxFetchBytes, signal }); sources.push(Object.freeze({ ...item, ...page, publishedAt: item.publishedAt ?? null })); }
      catch (error) { omissions.push({ url: item.url, reason: 'fetch-failed', detail: String(error.message) }); }
    }
    const citations = sources.map((source, index) => Object.freeze({ index: index + 1, title: source.title || source.canonicalUrl, url: source.canonicalUrl, contentSha256: source.contentSha256 }));
    const subject = { schema: 'forge.web.evidence.v1', query: String(query), sources: sources.map((source) => ({ url: source.canonicalUrl, contentSha256: source.contentSha256, fetchedAt: source.fetchedAt, publishedAt: source.publishedAt })), omissions };
    return Object.freeze({ ...subject, sources: Object.freeze(sources), citations: Object.freeze(citations), omissions: Object.freeze(omissions), evidenceSha256: canonicalSha256(subject) });
  }
}
