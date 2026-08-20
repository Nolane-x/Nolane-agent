import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NUI_V10_REVISION,
  buildNuiTaskProfile,
  compileNuiHostEnvelope,
  validateNuiInstallPlan,
} from '../src/ui-intelligence/nui-host-sidecar.mjs';

const GENERIC_CLI_PLAN = Object.freeze({
  agent_id: 'generic-cli',
  surface: 'process/CI/shell projection',
  recommended_mode: 'cli',
  canonical_skill: 'skills/using-nolane-ui/SKILL.md',
  canonical_graph: 'skills/skill-graph.json',
  project_files: ['scripts/nui-agent-export', 'scripts/nui-validate', 'skills/using-nolane-ui/SKILL.md'],
  bootstrap_instruction: 'Read skills/using-nolane-ui/SKILL.md, route through skills/nolane-ui/SKILL.md, and load only the owners triggered by the task profile.',
  permission_boundary: 'host permissions remain authoritative; the adapter never expands shell, network, filesystem, browser, MCP or image capabilities',
  copy_policy: 'bridge files point to canonical NUI contracts; do not duplicate the canonical skill body',
});

function flagshipProfile(overrides = {}) {
  return buildNuiTaskProfile({
    productSurface: 'Nolane Agent desktop mission workspace',
    userJob: 'Supervise long-running agent missions, inspect evidence, recover from failures, and control tools/providers.',
    visualAmbition: 'flagship',
    risk: ['lost-work', 'misleading-agent-state', 'unsafe-tool-action'],
    modalities: ['desktop', 'keyboard', 'pointer'],
    platform: ['Electron', 'Windows', 'macOS', 'Linux'],
    evidenceCapabilities: ['source-inspection', 'chromium-runtime', 'axe', 'screenshots'],
    namedSources: ['Nolane UI Intelligence v10'],
    hardConstraints: ['host permissions remain authoritative', 'generator cannot self-certify'],
    unresolvedFacts: ['independent screen-reader evidence'],
    ...overrides,
  });
}

test('NUI bridge pins the exact reviewed current v10 revision and accepts only the thin generic-cli projection', () => {
  assert.equal(NUI_V10_REVISION, '46780cdd58e41bea8338b2d27269d339c95e28e7');
  assert.equal(validateNuiInstallPlan(GENERIC_CLI_PLAN).valid, true);
  assert.throws(
    () => validateNuiInstallPlan({ ...GENERIC_CLI_PLAN, permission_boundary: 'adapter may enable shell and browser' }),
    /permission boundary/i,
  );
  assert.throws(
    () => validateNuiInstallPlan({ ...GENERIC_CLI_PLAN, canonical_skill: 'copied/all-skills.md' }),
    /canonical skill/i,
  );
});

test('task profile checksum is deterministic and reacts to any material source constraint change', () => {
  const a = flagshipProfile();
  const b = flagshipProfile();
  const changed = flagshipProfile({ hardConstraints: ['host permissions remain authoritative', 'generator cannot self-certify', 'offline-first'] });
  assert.match(a.checksum_sha256, /^[0-9a-f]{64}$/);
  assert.equal(a.checksum_sha256, b.checksum_sha256);
  assert.notEqual(a.checksum_sha256, changed.checksum_sha256);
  assert.equal(a.evidence_class, 'ARTIFACT_WORK');
  assert.equal(a.materiality, 'material');
});

test('flagship envelope compiles auditable routing, omissions, capability boundary and non-self-certifying obligations', () => {
  const profile = flagshipProfile();
  const envelope = compileNuiHostEnvelope({
    taskProfile: profile,
    nuiInstallPlan: GENERIC_CLI_PLAN,
    hostCapabilities: {
      shell: true,
      filesystem: true,
      browser: true,
      network: false,
      mcp: false,
      image: true,
      accessibilityTree: true,
      screenshots: true,
      performanceTrace: false,
      screenReader: false,
    },
    selectedOwners: [
      { owner: 'ui-contracting', trigger: 'material desktop product redesign' },
      { owner: 'routing-ui-work', trigger: 'multiple high-impact UI domains' },
      { owner: 'compiling-ui-obligations', trigger: 'release-relevant implementation' },
      { owner: 'challenging-ui-designs', trigger: 'flagship critique requirement' },
      { owner: 'binding-ui-evidence', trigger: 'runtime and screenshot evidence available' },
      { owner: 'gating-ui-completion', trigger: 'material completion must be independently gated' },
    ],
    inactiveHighImpactOwners: [
      { owner: 'empirical-evaluation', reason: 'evidence class is ARTIFACT_WORK, not EMPIRICAL_EVAL' },
    ],
    omissions: [
      { domain: 'screen-reader-independent-run', reason: 'runtime has no independent screen reader harness' },
    ],
  });

  assert.equal(envelope.schema_version, 'nolane.nui-host-envelope.v1');
  assert.equal(envelope.nui.revision, NUI_V10_REVISION);
  assert.equal(envelope.nui.mode, 'flagship');
  assert.equal(envelope.task_profile_checksum_sha256, profile.checksum_sha256);
  assert.equal(envelope.authority.host_authoritative, true);
  assert.equal(envelope.authority.authority_escalation, false);
  assert.deepEqual([...envelope.authority.allowed_capabilities].sort(), ['browser', 'filesystem', 'image', 'shell'].sort());
  assert.equal(envelope.capability_evidence.screenReader, 'UNKNOWN');
  assert.equal(envelope.capability_evidence.performanceTrace, 'UNKNOWN');
  assert.equal(envelope.capability_evidence.screenshots, 'AVAILABLE');
  assert.equal(envelope.route_justification_ledger.selected.length, 6);
  assert.equal(envelope.route_justification_ledger.inactive_high_impact.length, 1);
  assert.equal(envelope.omission_declaration[0].evidence_state, 'UNKNOWN');
  assert.equal(envelope.flagship_visual_synthesis.minimum_divergent_directions, 3);
  assert.equal(envelope.flagship_visual_synthesis.minimum_closed_critique_cycles, 2);
  assert.equal(envelope.flagship_visual_synthesis.generic_transfer_resistance_required, true);
  assert.equal(envelope.flagship_visual_synthesis.structural_responsive_evidence_required, true);
  assert.equal(envelope.completion.generator_ceiling, 'CRITIQUED');
  assert.equal(envelope.completion.generator_may_verify, false);
  assert.equal(envelope.completion.independent_verification_required, true);
});

test('NUI-described permissions never expand host capabilities', () => {
  const profile = flagshipProfile();
  const maliciousPlan = {
    ...GENERIC_CLI_PLAN,
    requested_capabilities: ['shell', 'network', 'browser', 'mcp'],
  };
  const envelope = compileNuiHostEnvelope({
    taskProfile: profile,
    nuiInstallPlan: maliciousPlan,
    hostCapabilities: { shell: false, filesystem: true, browser: false, network: false, mcp: false, image: false },
    selectedOwners: [{ owner: 'ui-contracting', trigger: 'material UI work' }],
    inactiveHighImpactOwners: [{ owner: 'browser-research', reason: 'browser capability unavailable' }],
    omissions: [{ domain: 'browser-runtime', reason: 'host browser capability unavailable' }],
  });
  assert.deepEqual(envelope.authority.allowed_capabilities, ['filesystem']);
  assert.equal(envelope.authority.denied_capabilities.includes('network'), true);
  assert.equal(envelope.authority.denied_capabilities.includes('browser'), true);
  assert.equal(envelope.authority.denied_capabilities.includes('mcp'), true);
});

test('material work fails closed when route justification or omission declaration is missing', () => {
  const profile = flagshipProfile();
  assert.throws(() => compileNuiHostEnvelope({ taskProfile: profile, nuiInstallPlan: GENERIC_CLI_PLAN, hostCapabilities: {}, selectedOwners: [], inactiveHighImpactOwners: [], omissions: [] }), /route justification/i);
  assert.throws(() => compileNuiHostEnvelope({ taskProfile: profile, nuiInstallPlan: GENERIC_CLI_PLAN, hostCapabilities: {}, selectedOwners: [{ owner: 'ui-contracting', trigger: 'material' }], inactiveHighImpactOwners: [], omissions: [] }), /omission declaration/i);
});