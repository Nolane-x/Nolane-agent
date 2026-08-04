import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonicalSha256, canonicalStringify } from '../src/core/canonical-json.mjs';
import { RemoteMicroVmSandbox, createRemoteMicroVmSandboxFromEnv } from '../src/execution/remote-microvm-sandbox.mjs';

const profile = Object.freeze({
  schemaVersion: 1,
  providerId: 'microvm-provider',
  executionKind: 'microvm',
  network: 'deny-by-default',
  secrets: 'none-by-default',
  maxTimeoutMs: 5_000,
});

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

function signedTransport(privateKey, { mutateReceipt = null, capability = profile } = {}) {
  return async (url, options = {}) => {
    if (options.method === undefined) return response(capability);
    const request = JSON.parse(options.body).request;
    const receipt = {
      schemaVersion: 1,
      type: 'remote-microvm-execution',
      providerId: capability.providerId,
      requestSha256: canonicalSha256(request),
      status: 'pass',
      startedAt: '2026-07-28T00:00:00.000Z',
      completedAt: '2026-07-28T00:00:01.000Z',
      isolation: { executionKind: 'microvm', network: 'deny-by-default', secrets: 'none-by-default' },
      stdout: 'verified output',
      stderr: '',
      stdoutSha256: canonicalSha256('verified output'),
      stderrSha256: canonicalSha256(''),
    };
    mutateReceipt?.(receipt);
    return response({ receipt, signature: sign(null, Buffer.from(canonicalStringify(receipt)), privateKey).toString('base64url') });
  };
}

const request = Object.freeze({ command: 'node', args: ['--version'], cwd: '.', timeoutMs: 1_000, input: { task: 'verify' } });

test('remote microVM sandbox accepts a signed request-bound receipt from a compatible provider', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const sandbox = new RemoteMicroVmSandbox({
    endpoint: 'https://sandbox.example',
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    fetchImpl: signedTransport(privateKey),
  });

  assert.equal((await sandbox.probe()).state, 'ready');
  const receipt = await sandbox.run(request);
  assert.equal(receipt.status, 'pass');
  assert.equal(receipt.stdout, 'verified output');
  assert.equal(receipt.isolation.network, 'deny-by-default');
});

test('remote microVM sandbox does not execute when no provider is configured', async () => {
  let calls = 0;
  const sandbox = new RemoteMicroVmSandbox({ fetchImpl: async () => { calls += 1; return response(profile); } });

  assert.deepEqual(await sandbox.probe(), { state: 'unavailable', reason: 'sandbox endpoint is not configured' });
  await assert.rejects(() => sandbox.run(request), /unavailable/i);
  assert.equal(calls, 0);
});

test('remote microVM sandbox rejects an unsafe provider profile and a tampered receipt', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
  const weak = new RemoteMicroVmSandbox({
    endpoint: 'https://sandbox.example', publicKey: publicKeyPem,
    fetchImpl: signedTransport(privateKey, { capability: { ...profile, network: 'allow-all' } }),
  });
  assert.equal((await weak.probe()).state, 'misconfigured');
  await assert.rejects(() => weak.run(request), /deny-by-default/i);

  const tampered = new RemoteMicroVmSandbox({
    endpoint: 'https://sandbox.example', publicKey: publicKeyPem,
    fetchImpl: signedTransport(privateKey, { mutateReceipt: (receipt) => { receipt.requestSha256 = '0'.repeat(64); } }),
  });
  await assert.rejects(() => tampered.run(request), /request digest/i);
});

test('remote microVM sandbox rejects a signed receipt with incomplete isolation evidence', async () => {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const sandbox = new RemoteMicroVmSandbox({
    endpoint: 'https://sandbox.example',
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    fetchImpl: signedTransport(privateKey, { mutateReceipt: (receipt) => { delete receipt.isolation.network; } }),
  });

  await assert.rejects(() => sandbox.run(request), /isolation profile/i);
});

test('sandbox configuration rejects plaintext endpoints and exposes no key material', async () => {
  const configured = createRemoteMicroVmSandboxFromEnv({
    FORGEOS_SANDBOX_ENDPOINT: 'http://sandbox.example',
    FORGEOS_SANDBOX_PUBLIC_KEY: 'secret-key-material',
  });

  const state = await configured.probe();
  assert.equal(state.state, 'misconfigured');
  assert.equal(JSON.stringify(state).includes('secret-key-material'), false);
});
