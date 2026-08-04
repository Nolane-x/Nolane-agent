import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { HttpCache } from '../src/web/cache.mjs';
import { extractHtml } from '../src/web/extract.mjs';
import { WebIntelligence, canonicalizeUrl } from '../src/web/intelligence.mjs';

async function fixtureServer(t) {
  let pageRequests = 0; let conditional = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/robots.txt') { res.end('User-agent: *\nDisallow: /blocked\n'); return; }
    if (req.url === '/blocked') { res.end('secret'); return; }
    if (req.url?.startsWith('/page')) {
      pageRequests += 1;
      if (req.headers['if-none-match'] === '"v1"') { conditional += 1; res.statusCode = 304; res.end(); return; }
      res.setHeader('etag', '"v1"'); res.setHeader('cache-control', 'max-age=0'); res.setHeader('content-type', 'text/html');
      res.end(`<!doctype html><html><head><title>Forge Page</title><link rel="canonical" href="/canonical"></head><body><nav>Noise menu</nav><main><h1>Agent Research</h1><p>Useful evidence about durable agents.</p><a href="/source">Source</a></main><script>alert(1)</script></body></html>`); return;
    }
    if (req.url === '/other') { res.setHeader('content-type', 'text/html'); res.end('<article><h1>Independent source</h1><p>Second domain-quality finding.</p></article>'); return; }
    res.statusCode = 404; res.end('not found');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return { base: `http://127.0.0.1:${server.address().port}`, stats: () => ({ pageRequests, conditional }) };
}

test('extractHtml strips active boilerplate and preserves readable structure', () => {
  const result = extractHtml('<html><head><title>X</title></head><body><header>menu</header><main><h1>Hello</h1><p>World &amp; proof.</p><script>bad()</script></main></body></html>', 'https://example.test/a');
  assert.equal(result.title, 'X');
  assert.match(result.text, /Hello\n+World & proof/);
  assert.doesNotMatch(result.text, /menu|bad/);
  assert.match(result.contentSha256, /^[a-f0-9]{64}$/);
});

test('WebIntelligence respects robots, canonicalizes URLs, caches, and revalidates with ETag', async (t) => {
  const server = await fixtureServer(t);
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-web-')); t.after(() => rm(root, { recursive: true, force: true }));
  const cache = new HttpCache(path.join(root, 'web.db')); t.after(() => cache.close());
  const web = new WebIntelligence({ cache, userAgent: 'ForgeStudioBot/0.1' });
  await assert.rejects(() => web.fetch(`${server.base}/blocked`), /robots/i);
  const first = await web.fetch(`${server.base}/page?utm_source=x&b=2&a=1#frag`);
  assert.equal(first.canonicalUrl, `${server.base}/canonical`);
  assert.doesNotMatch(first.text, /Noise menu|alert/);
  const second = await web.fetch(`${server.base}/page?a=1&b=2`);
  assert.equal(second.contentSha256, first.contentSha256);
  assert.ok(server.stats().conditional >= 1);
  assert.equal(canonicalizeUrl('https://EXAMPLE.com/a?utm_source=x&b=2&a=1#x'), 'https://example.com/a?a=1&b=2');
});

test('research deduplicates sources, favors domain diversity, and emits bounded citations/evidence', async (t) => {
  const server = await fixtureServer(t);
  const root = await mkdtemp(path.join(os.tmpdir(), 'forge-research-')); t.after(() => rm(root, { recursive: true, force: true }));
  const cache = new HttpCache(path.join(root, 'web.db')); t.after(() => cache.close());
  const searchProvider = {
    id: 'fixture-search',
    async search() {
      return [
        { url: `${server.base}/page?utm_source=one`, title: 'Primary', snippet: 'durable agent', score: 0.95, publishedAt: '2026-07-25' },
        { url: `${server.base}/page`, title: 'Duplicate', snippet: 'same', score: 0.8, publishedAt: '2026-07-24' },
        { url: `http://localhost:${new URL(server.base).port}/other`, title: 'Independent', snippet: 'second', score: 0.75, publishedAt: '2026-07-26' },
      ];
    },
  };
  const web = new WebIntelligence({ cache, searchProviders: [searchProvider], respectRobots: false });
  const packet = await web.research({ query: 'durable AI agents', maxSources: 2, maxFetchBytes: 100_000 });
  assert.equal(packet.sources.length, 2);
  assert.equal(new Set(packet.sources.map((source) => source.domain)).size, 2);
  assert.deepEqual(packet.citations.map((item) => item.index), [1, 2]);
  assert.match(packet.evidenceSha256, /^[a-f0-9]{64}$/);
  assert.ok(packet.sources.every((source) => source.contentSha256));
  assert.ok(packet.omissions.some((item) => item.reason === 'duplicate-url'));
});

test('Brave and Tavily search adapters send bounded requests and normalize public results', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('api.search.brave.com')) {
      return new Response(JSON.stringify({ web: { results: [{ url: 'https://example.com/brave', title: 'Brave result', description: 'A result', age: '2026-07-26' }] } }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ results: [{ url: 'https://example.org/tavily', title: 'Tavily result', content: 'Another result', score: 0.91, published_date: '2026-07-25' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const { BraveSearchProvider, TavilySearchProvider } = await import('../src/web/search-providers.mjs');
  const brave = new BraveSearchProvider({ apiKey: 'brave-secret', fetchImpl });
  const tavily = new TavilySearchProvider({ apiKey: 'tavily-secret', fetchImpl });
  const braveResults = await brave.search({ query: 'agent memory', limit: 200 });
  const tavilyResults = await tavily.search({ query: 'agent memory', limit: 200 });
  assert.equal(braveResults[0].title, 'Brave result');
  assert.equal(tavilyResults[0].score, 0.91);
  assert.match(calls[0].url, /count=20/);
  assert.equal(calls[0].init.headers['x-subscription-token'], 'brave-secret');
  assert.equal(JSON.parse(calls[1].init.body).max_results, 20);
  assert.doesNotMatch(JSON.stringify(brave.publicView()), /brave-secret/);
  assert.doesNotMatch(JSON.stringify(tavily.publicView()), /tavily-secret/);
});
