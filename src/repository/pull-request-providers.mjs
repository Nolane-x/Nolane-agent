import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

function baseUrl(value) {
  const parsed = new URL(required(value, 'baseUrl'));
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))) throw new Error('Pull request provider endpoint must use HTTPS');
  return parsed.href.replace(/\/$/, '');
}

function publicResult(provider, response, payload, requestSha256) {
  const url = provider === 'gitlab'
    ? response.web_url ?? response.html_url ?? response.links?.html?.href ?? null
    : provider === 'bitbucket'
      ? response.links?.html?.href ?? response.html_url ?? response.web_url ?? null
      : response.html_url ?? response.web_url ?? response.links?.html?.href ?? null;
  const id = response.number ?? response.iid ?? response.id ?? null;
  return Object.freeze({ schema: 'forge.pull-request.result.v1', provider, id, url, requestSha256, responseSha256: canonicalSha256(payload) });
}

export class PullRequestProviders {
  constructor({ fetch = globalThis.fetch, credentialResolver } = {}) {
    if (typeof fetch !== 'function') throw new TypeError('fetch is required');
    if (typeof credentialResolver !== 'function') throw new TypeError('credentialResolver is required');
    this.fetch = fetch;
    this.credentialResolver = credentialResolver;
  }

  buildRequest(input = {}, token) {
    const provider = required(input.provider, 'provider').toLowerCase();
    const root = baseUrl(input.baseUrl);
    const title = required(input.title, 'title');
    const sourceBranch = required(input.sourceBranch, 'sourceBranch');
    const targetBranch = required(input.targetBranch, 'targetBranch');
    const body = String(input.body ?? '');
    if (body.length > 1_000_000 || title.length > 1_000) throw new Error('Pull request title or body exceeds limit');
    const headers = { accept: 'application/json', 'content-type': 'application/json' };
    let url;
    let payload;
    if (provider === 'github') {
      const owner = encodeURIComponent(required(input.owner, 'owner'));
      const repository = encodeURIComponent(required(input.repository, 'repository'));
      url = `${root}/repos/${owner}/${repository}/pulls`;
      headers.authorization = `Bearer ${token}`;
      payload = { title, head: sourceBranch, base: targetBranch, body };
      if (input.draft !== undefined) payload.draft = Boolean(input.draft);
    } else if (provider === 'gitlab') {
      const project = encodeURIComponent(required(input.project, 'project'));
      url = `${root}/api/v4/projects/${project}/merge_requests`;
      headers['private-token'] = token;
      payload = { title, source_branch: sourceBranch, target_branch: targetBranch, description: body };
      if (input.issueId !== undefined) payload.description = `${body}${body ? '\n\n' : ''}Closes #${String(input.issueId)}`;
    } else if (provider === 'bitbucket') {
      const workspace = encodeURIComponent(required(input.workspace, 'workspace'));
      const repository = encodeURIComponent(required(input.repository, 'repository'));
      url = `${root}/2.0/repositories/${workspace}/${repository}/pullrequests`;
      headers.authorization = `Bearer ${token}`;
      payload = { title, description: body, source: { branch: { name: sourceBranch } }, destination: { branch: { name: targetBranch } } };
    } else {
      throw new Error(`Unsupported pull request provider: ${provider}`);
    }
    const publicHeaders = Object.fromEntries(Object.entries(headers).filter(([key]) => !['authorization', 'private-token'].includes(key)));
    return Object.freeze({ provider, url, options: Object.freeze({ method: 'POST', headers: Object.freeze(headers), body: JSON.stringify(payload) }), requestSha256: canonicalSha256({ provider, url, method: 'POST', headers: publicHeaders, payload }) });
  }

  async createPullRequest(input = {}) {
    const provider = required(input.provider, 'provider').toLowerCase();
    const token = String(await this.credentialResolver({ provider, baseUrl: input.baseUrl }) ?? '');
    if (!token) throw new Error(`No credential available for ${provider}`);
    const request = this.buildRequest(input, token);
    let response;
    try {
      response = await this.fetch(request.url, request.options);
    } finally {
      // Keep the credential scoped to this call; it is never retained on the instance or result.
    }
    const contentType = response.headers?.get?.('content-type') ?? '';
    const payload = contentType.includes('json') && typeof response.json === 'function' ? await response.json() : { message: typeof response.text === 'function' ? await response.text() : '' };
    if (!response.ok) {
      const error = new Error(`${provider} pull request failed with HTTP ${response.status}`);
      error.code = 'PULL_REQUEST_PROVIDER_FAILED';
      error.status = response.status;
      error.responseSha256 = canonicalSha256(payload);
      throw error;
    }
    return publicResult(provider, payload, payload, request.requestSha256);
  }
}
