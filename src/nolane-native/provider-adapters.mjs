import { RetryableProviderError } from './provider-registry.mjs';
function providerError(message, { retryable = false, status = null, cause = null } = {}) {
  const error = new Error(message, cause ? { cause } : undefined);
  error.retryable = retryable;
  error.status = status;
  return error;
}

function validateResponse(value) {
  if (!value || typeof value !== 'object' || value.type !== 'final' || typeof value.answer !== 'string') {
    throw providerError('provider returned an invalid typed response');
  }
  return value;
}

export function createLocalHttpProvider({ id, endpoint, fetchImpl = globalThis.fetch }) {
  if (!id || !endpoint || typeof fetchImpl !== 'function') throw new TypeError('id, endpoint and fetchImpl are required');
  return {
    id,
    kind: 'local-http',
    async invoke({ payload, signal } = {}) {
      let response;
      try {
        response = await fetchImpl(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ schema: 'nolane.agent.provider-request.v1', payload: payload ?? {} }),
          signal
        });
      } catch (cause) {
        throw providerError(`provider ${id} request failed`, { retryable: true, cause });
      }
      if (!response.ok) {
        const detail = typeof response.text === 'function' ? await response.text().catch(() => '') : '';
        throw providerError(`provider ${id} failed with HTTP ${response.status}${detail ? `: ${detail}` : ''}`, {
          retryable: response.status === 408 || response.status === 429 || response.status >= 500,
          status: response.status
        });
      }
      return validateResponse(await response.json());
    }
  };
}

export function createCliProvider({ id, command, runner }) {
  if (!id || !command || typeof runner !== 'function') throw new TypeError('id, command and runner are required');
  return {
    id,
    kind: 'cli',
    async invoke({ payload, signal } = {}) {
      const request = JSON.stringify({ schema: 'nolane.agent.provider-request.v1', payload: payload ?? {} });
      const result = await runner(command, ['--json', '--request', request], {
        shell: false,
        windowsHide: true,
        signal,
        encoding: 'utf8'
      });
      if (!result || result.code !== 0) {
        throw providerError(`provider ${id} CLI failed`, { retryable: false });
      }
      try {
        return validateResponse(JSON.parse(result.stdout));
      } catch (cause) {
        if (cause?.retryable !== undefined) throw cause;
        throw providerError(`provider ${id} returned invalid JSON`, { cause });
      }
    }
  };
}


function existingProviderView(provider) {
  const view = typeof provider?.publicView === 'function' ? provider.publicView() : {};
  return { ...view, ...(provider?.profile ?? {}) };
}

function parseNolaneFinal(text) {
  const source = String(text ?? '').trim();
  if (!source) return { answer: '', criteriaProof: [] };
  try {
    const value = JSON.parse(source);
    if (value?.schema === 'nolane.agent.final.v1' && typeof value.answer === 'string') {
      return { answer: value.answer, criteriaProof: Array.isArray(value.criteriaProof) ? value.criteriaProof : [] };
    }
  } catch {}
  return { answer: source, criteriaProof: [] };
}

function existingProviderRetryable(error) {
  if (error?.retryable === true) return true;
  const message = String(error?.message ?? error).toLowerCase();
  return error?.code === 'ENOENT' || /timed out|timeout|temporar|unavailable|connection|econn|rate limit|http 5\d\d/.test(message);
}

export function createExistingProviderAdapter({ provider, priority = 100 } = {}) {
  if (!provider?.id || typeof provider.complete !== 'function') throw new TypeError('provider with id and complete() is required');
  const view = existingProviderView(provider);
  let disabledForRun = false;
  return {
    id: String(provider.id),
    priority: Number(priority),
    capabilities: [...(view.capabilities ?? ['coding'])].map(String),
    async invoke({ stateCapsule, payload, signal }) {
      if (disabledForRun) throw new RetryableProviderError(`Provider ${provider.id} is disabled for this run after a retryable failure`);
      const request = Object.freeze({
        schema: 'nolane.agent.native-provider-turn.v1',
        state: stateCapsule,
        objective: payload.objective,
        criteria: payload.criteria,
        context: payload.context,
        transcript: payload.transcript,
        effects: payload.effects,
      });
      let completion;
      try {
        completion = await provider.complete({
          messages: [
            { role: 'system', content: 'Act through the offered tools. Return a Nolane typed final envelope only after evidence exists.' },
            { role: 'user', content: JSON.stringify(request) },
          ],
          tools: payload.tools.map((tool) => ({ name: tool.name, description: tool.description ?? '', parameters: tool.parameters ?? { type: 'object', properties: {} } })),
          signal,
        });
      } catch (error) {
        if (existingProviderRetryable(error)) {
          disabledForRun = true;
          throw new RetryableProviderError(`Provider ${provider.id} failed retryably: ${error.message}`, { cause: error });
        }
        throw error;
      }
      const tokens = Number(completion?.usage?.totalTokens ?? 0);
      const call = completion?.toolCalls?.[0];
      if (call) return Object.freeze({ type: 'tool', tool: String(call.name), input: structuredClone(call.arguments ?? {}), expectedEffect: call.expectedEffect ? structuredClone(call.expectedEffect) : null, tokens });
      const final = parseNolaneFinal(completion?.text);
      return Object.freeze({ type: 'final', answer: final.answer, criteriaProof: Object.freeze(final.criteriaProof.map((item) => Object.freeze({ ...item }))), tokens });
    },
  };
}
