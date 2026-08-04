import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
const http = await readFile(new URL('../src/server/http-server.mjs', import.meta.url), 'utf8');
const routes = await readFile(new URL('../src/server/routes.mjs', import.meta.url), 'utf8');
test('application composes trusted instruction policy and exposes it to server and AgentLoop', () => {
  assert.match(app, /new InstructionPolicyService\(\{/);
  assert.match(app, /new TrustAwareInstructionPolicy\(\{/);
  assert.match(app, /createHttpServer\(\{[^}]*instructionPolicy/s);
  assert.match(app, /instructionPolicy:\s*governedInstructionPolicy/);
  assert.match(http, /instructionPolicy = null/);
  assert.match(routes, /\/api\/instruction-policy/);
});
