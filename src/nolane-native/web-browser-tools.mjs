import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());

function safeUrl(raw, allowHosts) {
  let url;
  try { url = new URL(String(raw ?? '')); } catch { throw new TypeError('Web URL is invalid'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error(`Web URL protocol is not allowed: ${url.protocol}`);
  if (url.username || url.password) throw new Error('Web URL credentials are not allowed');
  if (allowHosts.size > 0 && !allowHosts.has(url.hostname.toLowerCase())) throw new Error(`Web host is not allowed: ${url.hostname}`);
  url.hash = '';
  return url;
}

async function readBounded(response, maxBytes) {
  if (!response.body?.getReader) {
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > maxBytes) throw new Error(`Web response byte limit exceeded: ${bytes.length} > ${maxBytes}`);
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) { await reader.cancel().catch(() => {}); throw new Error(`Web response byte limit exceeded: ${total} > ${maxBytes}`); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

function receipt(schema, body) {
  const base = { schema, ...body };
  return Object.freeze({ ...base, receiptSha256: sha256(canonical(base)) });
}

export function createNativeWebBrowserTools({ fetchImpl = globalThis.fetch, browserDriver = null, allowHosts = [], maxResponseBytes = 1_000_000, timeoutMs = 15_000 } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl is required');
  if (browserDriver !== null && typeof browserDriver?.execute !== 'function') throw new TypeError('browserDriver must expose execute()');
  const hosts = new Set(allowHosts.map((host) => String(host).toLowerCase()));
  const byteLimit = Math.max(1, Number(maxResponseBytes) || 1_000_000);
  const requestTimeout = Math.max(50, Number(timeoutMs) || 15_000);

  return Object.freeze({
    async fetchText({ url: rawUrl, method = 'GET', headers = {} } = {}) {
      const url = safeUrl(rawUrl, hosts);
      if (!['GET', 'HEAD'].includes(String(method).toUpperCase())) throw new Error('Native web fetch supports GET and HEAD only');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(new Error('Web fetch timed out')), requestTimeout);
      timer.unref?.();
      try {
        const response = await fetchImpl(url, { method: String(method).toUpperCase(), headers: { accept: 'text/plain, text/html, application/json', ...headers }, redirect: 'error', signal: controller.signal });
        const bytes = await readBounded(response, byteLimit);
        const contentType = String(response.headers?.get?.('content-type') ?? 'application/octet-stream').split(';')[0].trim();
        if (!['text/plain', 'text/html', 'application/json', 'application/xml', 'text/xml', 'application/javascript'].includes(contentType)) throw new Error(`Web content type is not text-safe: ${contentType}`);
        return receipt('nolane.native.web-fetch.v1', { url: url.toString(), status: Number(response.status), ok: Boolean(response.ok), contentType, bytes: bytes.length, text: bytes.toString('utf8'), untrusted: true, networkSource: true });
      } finally { clearTimeout(timer); }
    },

    async browser({ action, url: rawUrl = null, target = null, text = null, approvals = [] } = {}) {
      if (!browserDriver) throw new Error('Native browser driver is not configured');
      const normalizedAction = String(action ?? '');
      if (!['navigate', 'snapshot', 'find', 'click', 'fill', 'type', 'press'].includes(normalizedAction)) throw new TypeError(`Unsupported browser action: ${normalizedAction}`);
      const computerUse = ['click', 'fill', 'type', 'press'].includes(normalizedAction);
      if (computerUse && !approvals.includes('browser:computer-use')) throw new Error(`Approval required for browser computer use: ${normalizedAction}`);
      const input = { action: normalizedAction };
      if (rawUrl !== null) input.url = safeUrl(rawUrl, hosts).toString();
      if (target !== null) { const value = String(target); if (!value || value.length > 2_000) throw new TypeError('Browser target is invalid'); input.target = value; }
      if (text !== null) { const value = String(text); if (value.length > 100_000) throw new TypeError('Browser text is too long'); input.text = value; }
      const result = await browserDriver.execute(Object.freeze(input));
      return receipt('nolane.native.browser-action.v1', { action: normalizedAction, computerUse, approved: !computerUse || approvals.includes('browser:computer-use'), result: structuredClone(result), untrusted: true });
    },

    snapshot() { return Object.freeze({ schema: 'nolane.native.web-browser-tools.v1', allowHosts: [...hosts].sort(), maxResponseBytes: byteLimit, timeoutMs: requestTimeout, browserConfigured: Boolean(browserDriver) }); },
  });
}
