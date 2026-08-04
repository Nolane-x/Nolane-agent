import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const REQUIRED = [
  'NATIVE-MCP-OAUTH-RUNTIME',
  'NATIVE-BROWSER-SUPERVISOR-RUNTIME',
  'NATIVE-ASYNC-DELEGATION-RUNTIME',
  'NATIVE-PTY-SESSION-RUNTIME',
  'NATIVE-GATEWAY-RECOVERY-RUNTIME',
  'NATIVE-LOCAL-MEDIA-PIPELINE-RUNTIME',
];

test('wave6 contracts are verified with direct tests and production wiring', async () => {
  const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
  const byId = new Map(catalog.contracts.map((entry) => [entry.id, entry]));
  for (const id of REQUIRED) {
    const contract = byId.get(id);
    assert.ok(contract, `missing ${id}`);
    assert.equal(contract.status, 'verified');
    assert.ok(contract.entrypoints.length > 0);
    assert.ok(contract.tests.some((p) => p.includes('wave6')));
    assert.ok(contract.productionWiring.length > 0);
  }
});

test('wave6 maps exact local runtime paths while real transports and providers stay external', async () => {
  const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
  const mapping = new Map(conformance.candidateMappings.map((entry) => [entry.sourcePath, entry]));
  const expected = new Map([
    ['tools/mcp_oauth_manager.py', 'NATIVE-MCP-OAUTH-RUNTIME'],
    ['tools/browser_supervisor.py', 'NATIVE-BROWSER-SUPERVISOR-RUNTIME'],
    ['tools/browser_dialog_tool.py', 'NATIVE-BROWSER-SUPERVISOR-RUNTIME'],
    ['tools/async_delegation.py', 'NATIVE-ASYNC-DELEGATION-RUNTIME'],
    ['tools/delegation_live_log.py', 'NATIVE-ASYNC-DELEGATION-RUNTIME'],
    ['nolane_native_cli/pty_session.py', 'NATIVE-PTY-SESSION-RUNTIME'],
    ['gateway/shutdown_watchdog.py', 'NATIVE-GATEWAY-RECOVERY-RUNTIME'],
    ['gateway/memory_monitor.py', 'NATIVE-GATEWAY-RECOVERY-RUNTIME'],
    ['apps/desktop/src/lib/voice-playback.ts', 'NATIVE-LOCAL-MEDIA-PIPELINE-RUNTIME'],
    ['apps/desktop/src/lib/voice-barge-in.ts', 'NATIVE-LOCAL-MEDIA-PIPELINE-RUNTIME'],
    ['apps/desktop/src/lib/media.ts', 'NATIVE-LOCAL-MEDIA-PIPELINE-RUNTIME'],
  ]);
  for (const [sourcePath, contractId] of expected) {
    assert.equal(mapping.get(sourcePath)?.contractId, contractId, sourcePath);
    assert.equal(mapping.get(sourcePath)?.status, 'verified', sourcePath);
  }
  assert.equal(mapping.get('tools/discord_tool.py')?.status, 'external_gate');
  assert.equal(mapping.get('tools/xai_video_tools.py')?.contractId, 'NATIVE-MEDIA-GENERATION-PROVIDER-TCK');
  assert.equal(mapping.get('tools/xai_video_tools.py')?.status, 'verified');
  assert.equal(mapping.get('agent/transports/bedrock.py')?.contractId, 'NATIVE-BEDROCK-ACP-TRANSPORT');
  assert.equal(mapping.get('agent/transports/bedrock.py')?.status, 'verified');
  assert.equal(conformance.summary.completeParityClaimAllowed, false);
});
