function required(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
}
function boundedLimit(value) { return Math.max(1, Math.min(20, Number(value) || 10)); }
async function responseJson(response, label) {
  if (!response.ok) throw new Error(`${label} search failed with HTTP ${response.status}`);
  const type = String(response.headers.get('content-type') ?? '');
  if (!type.includes('json')) throw new Error(`${label} search returned non-JSON content`);
  return response.json();
}

export class BraveSearchProvider {
  constructor({ apiKey, fetchImpl = globalThis.fetch, endpoint = 'https://api.search.brave.com/res/v1/web/search' } = {}) {
    this.id = 'brave'; this.apiKey = required(apiKey, 'Brave API key'); this.fetchImpl = fetchImpl; this.endpoint = endpoint;
  }
  publicView() { return Object.freeze({ id: this.id, label: 'Brave Search', kind: 'web-search', configured: true }); }
  async search({ query, limit = 10, signal = null } = {}) {
    const url = new URL(this.endpoint); url.searchParams.set('q', required(query, 'query')); url.searchParams.set('count', String(boundedLimit(limit))); url.searchParams.set('safesearch', 'moderate');
    const payload = await responseJson(await this.fetchImpl(url, { method: 'GET', headers: { accept: 'application/json', 'x-subscription-token': this.apiKey }, signal }), 'Brave');
    return Object.freeze((payload.web?.results ?? []).map((item, index) => Object.freeze({ url: item.url, title: item.title ?? '', snippet: item.description ?? '', score: Number(item.score ?? (1 - index / Math.max(1, boundedLimit(limit)))), publishedAt: item.page_age ?? item.age ?? null })));
  }
}

export class TavilySearchProvider {
  constructor({ apiKey, fetchImpl = globalThis.fetch, endpoint = 'https://api.tavily.com/search' } = {}) {
    this.id = 'tavily'; this.apiKey = required(apiKey, 'Tavily API key'); this.fetchImpl = fetchImpl; this.endpoint = endpoint;
  }
  publicView() { return Object.freeze({ id: this.id, label: 'Tavily Search', kind: 'web-search', configured: true }); }
  async search({ query, limit = 10, signal = null } = {}) {
    const payload = await responseJson(await this.fetchImpl(this.endpoint, { method: 'POST', headers: { accept: 'application/json', 'content-type': 'application/json' }, body: JSON.stringify({ api_key: this.apiKey, query: required(query, 'query'), max_results: boundedLimit(limit), search_depth: 'basic', include_answer: false, include_raw_content: false }), signal }), 'Tavily');
    return Object.freeze((payload.results ?? []).map((item, index) => Object.freeze({ url: item.url, title: item.title ?? '', snippet: item.content ?? '', score: Number(item.score ?? (1 - index / Math.max(1, boundedLimit(limit)))), publishedAt: item.published_date ?? null })));
  }
}
