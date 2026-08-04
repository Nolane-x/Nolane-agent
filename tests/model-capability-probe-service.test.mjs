import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelCapabilityProbeService } from '../src/providers/model-capability-probe-service.mjs';

test('capability probe classifies pass unsupported and error without leaking secrets', async () => {
  const provider = { complete: async ({ tools, responseFormat }) => {
    if (tools?.length) return { text: '', toolCalls: [{ name: 'echo', arguments: { value: 'ok' } }] };
    if (responseFormat) throw Object.assign(new Error('unsupported sk-secret-token'), { statusCode: 400 });
    return { text: 'OK' };
  } };
  const service = new ModelCapabilityProbeService({ getProvider: () => provider, clock: () => '2026-08-03T00:00:00.000Z' });
  const result = await service.probe({ providerId: 'p', modelId: 'm', probes: ['text','tools','structuredOutput'] });
  assert.equal(result.capabilities.text, true);
  assert.equal(result.capabilities.tools, true);
  assert.equal(result.capabilities.structuredOutput, false);
  assert.equal(JSON.stringify(result).includes('sk-secret-token'), false);
});
