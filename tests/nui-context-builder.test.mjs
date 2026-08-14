import test from 'node:test';
import assert from 'node:assert/strict';

import { ContextBuilder } from '../src/agent/context-builder.mjs';

const assembler = {
  assemble({ stable, workspace, turn }) {
    return {
      tiers: {
        stable: { content: stable.map((item) => item.text).join('\n') },
        workspace: { content: workspace.map((item) => item.text).join('\n') },
        turn: { content: turn.map((item) => item.text).join('\n') },
      },
      omissions: [],
    };
  },
};

const contextPack = {
  contextPackSha256: 'context-pack-fixture',
  compiled: {
    omissions: [],
    context: { system: [], skills: [], code: [], artifacts: [], memory: [], references: [], task: [{ id: 'task', text: 'Redesign the mission workspace' }], toolOutput: [] },
  },
};

const nuiEnvelope = Object.freeze({
  schema_version: 'nolane.nui-host-envelope.v1',
  task_profile_checksum_sha256: 'a'.repeat(64),
  nui: { revision: '719981b7a2cf0e8406672d20ce1840e7a26ef5b8', mode: 'flagship' },
  authority: { host_authoritative: true, authority_escalation: false, allowed_capabilities: ['filesystem'], denied_capabilities: ['network'] },
  flagship_visual_synthesis: { minimum_divergent_directions: 3, minimum_closed_critique_cycles: 2 },
  completion: { generator_ceiling: 'CRITIQUED', generator_may_verify: false, independent_verification_required: true },
});

test('ContextBuilder injects the bounded NUI envelope into stable context without mutating host execution authority', () => {
  const builder = new ContextBuilder({ assembler });
  const built = builder.build(contextPack, { nuiEnvelope });
  const system = built.messages[0].content;
  assert.match(system, /nui-host-envelope/);
  assert.match(system, /719981b7a2cf0e8406672d20ce1840e7a26ef5b8/);
  assert.match(system, /generator_may_verify=false/);
  assert.match(system, /host_authoritative=true/);
  assert.match(system, /allowed_capabilities=filesystem/);
  assert.doesNotMatch(system, /allowed_capabilities=.*network/);
});

test('ContextBuilder rejects a NUI envelope that attempts authority escalation or self-certification', () => {
  const builder = new ContextBuilder({ assembler });
  assert.throws(() => builder.build(contextPack, { nuiEnvelope: { ...nuiEnvelope, authority: { ...nuiEnvelope.authority, authority_escalation: true } } }), /authority escalation/i);
  assert.throws(() => builder.build(contextPack, { nuiEnvelope: { ...nuiEnvelope, completion: { ...nuiEnvelope.completion, generator_may_verify: true } } }), /self-certification/i);
});
