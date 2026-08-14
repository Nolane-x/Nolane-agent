import { createHash } from 'node:crypto';

export const NUI_V10_REVISION = '46780cdd58e41bea8338b2d27269d339c95e28e7';
export const NUI_REPOSITORY = 'Nolane-x/Nolane-UI-Intelligence';

const ACTION_CAPABILITIES = Object.freeze(['shell', 'filesystem', 'browser', 'network', 'mcp', 'image']);
const EVIDENCE_CAPABILITIES = Object.freeze([
  'sourceInspection',
  'chromiumRuntime',
  'axe',
  'screenshots',
  'accessibilityTree',
  'performanceTrace',
  'screenReader',
  'externalResearch',
]);
const FLAGSHIP_AMBITIONS = new Set(['flagship', 'exceptional', 'experiential']);

function sha256(value) {
  return createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function stringList(value, field) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError(`${field} must be an array`);
  return Object.freeze(value.map((item) => String(item).trim()).filter(Boolean));
}

function requiredString(value, field) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${field} is required`);
  return text;
}

function normalizeCapabilityRecord(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('hostCapabilities must be an object');
  return Object.fromEntries(Object.entries(value).map(([key, enabled]) => [key, enabled === true]));
}

export function validateNuiInstallPlan(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) throw new TypeError('NUI install plan is required');
  if (plan.agent_id !== 'generic-cli') throw new TypeError('NUI host bridge requires the generic-cli projection');
  if (plan.canonical_skill !== 'skills/using-nolane-ui/SKILL.md') throw new TypeError('NUI canonical skill must remain skills/using-nolane-ui/SKILL.md');
  if (plan.canonical_graph !== 'skills/skill-graph.json') throw new TypeError('NUI canonical graph must remain skills/skill-graph.json');
  if (!String(plan.bootstrap_instruction ?? '').includes('load only the owners triggered by the task profile')) {
    throw new TypeError('NUI bootstrap must preserve routed progressive disclosure');
  }
  const boundary = String(plan.permission_boundary ?? '').toLowerCase();
  if (!boundary.includes('host permissions remain authoritative') || !boundary.includes('never expands')) {
    throw new TypeError('NUI permission boundary must keep host permissions authoritative and forbid expansion');
  }
  const copyPolicy = String(plan.copy_policy ?? '').toLowerCase();
  if (!copyPolicy.includes('do not duplicate') || !copyPolicy.includes('canonical')) {
    throw new TypeError('NUI bridge must point to canonical contracts instead of copying the skill graph');
  }
  return Object.freeze({ valid: true, agent_id: plan.agent_id });
}

export function buildNuiTaskProfile({
  productSurface,
  userJob,
  visualAmbition = 'standard',
  risk = [],
  modalities = [],
  platform = [],
  evidenceCapabilities = [],
  namedSources = [],
  hardConstraints = [],
  unresolvedFacts = [],
  materiality = 'material',
  evidenceClass = 'ARTIFACT_WORK',
} = {}) {
  const profile = Object.freeze({
    schema_version: 'nolane.nui-task-profile.v1',
    evidence_class: requiredString(evidenceClass, 'evidenceClass'),
    materiality: requiredString(materiality, 'materiality'),
    product_surface: requiredString(productSurface, 'productSurface'),
    user_job: requiredString(userJob, 'userJob'),
    visual_ambition: requiredString(visualAmbition, 'visualAmbition').toLowerCase(),
    risk: stringList(risk, 'risk'),
    modalities: stringList(modalities, 'modalities'),
    platform: stringList(platform, 'platform'),
    evidence_capabilities: stringList(evidenceCapabilities, 'evidenceCapabilities'),
    named_sources: stringList(namedSources, 'namedSources'),
    hard_constraints: stringList(hardConstraints, 'hardConstraints'),
    unresolved_facts: stringList(unresolvedFacts, 'unresolvedFacts'),
  });
  return Object.freeze({ ...profile, checksum_sha256: sha256(canonical(profile)) });
}

function normalizeLedger(items, kind) {
  if (!Array.isArray(items)) throw new TypeError(`${kind} route ledger must be an array`);
  return Object.freeze(items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`${kind} route ledger item ${index} must be an object`);
    const owner = requiredString(item.owner, `${kind}[${index}].owner`);
    const reasonField = kind === 'selected' ? 'trigger' : 'reason';
    return Object.freeze({ owner, [reasonField]: requiredString(item[reasonField], `${kind}[${index}].${reasonField}`) });
  }));
}

function normalizeOmissions(omissions) {
  if (!Array.isArray(omissions)) throw new TypeError('omission declaration must be an array');
  return Object.freeze(omissions.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`omission[${index}] must be an object`);
    return Object.freeze({
      domain: requiredString(item.domain, `omission[${index}].domain`),
      reason: requiredString(item.reason, `omission[${index}].reason`),
      evidence_state: 'UNKNOWN',
    });
  }));
}

function capabilityEvidence(host) {
  const result = {};
  for (const capability of EVIDENCE_CAPABILITIES) result[capability] = host[capability] === true ? 'AVAILABLE' : 'UNKNOWN';
  return Object.freeze(result);
}

function flagshipContract(profile) {
  if (!FLAGSHIP_AMBITIONS.has(profile.visual_ambition)) return null;
  return Object.freeze({
    packet: 'flagship-visual-synthesis',
    concrete_visual_thesis_required: true,
    minimum_divergent_directions: 3,
    explicit_attention_hierarchy_required: true,
    resolved_typography_composition_color_material_motion_required: true,
    domain_linked_signature_required: true,
    restraint_rule_required: true,
    bounded_reference_mechanisms_required: true,
    generic_transfer_resistance_required: true,
    structural_responsive_evidence_required: true,
    minimum_closed_critique_cycles: 2,
  });
}

export function compileNuiHostEnvelope({
  taskProfile,
  nuiInstallPlan,
  hostCapabilities = {},
  selectedOwners = [],
  inactiveHighImpactOwners = [],
  omissions = [],
} = {}) {
  validateNuiInstallPlan(nuiInstallPlan);
  if (!taskProfile || taskProfile.schema_version !== 'nolane.nui-task-profile.v1' || !/^[0-9a-f]{64}$/.test(String(taskProfile.checksum_sha256 ?? ''))) {
    throw new TypeError('valid NUI task profile with checksum is required');
  }
  const selected = normalizeLedger(selectedOwners, 'selected');
  const inactive = normalizeLedger(inactiveHighImpactOwners, 'inactive');
  const material = taskProfile.materiality === 'material';
  if (material && selected.length === 0) throw new TypeError('material NUI work requires route justification for selected owners');
  const omissionDeclaration = normalizeOmissions(omissions);
  if (material && omissionDeclaration.length === 0) throw new TypeError('material NUI work requires an omission declaration');

  const host = normalizeCapabilityRecord(hostCapabilities);
  const allowed = ACTION_CAPABILITIES.filter((capability) => host[capability] === true);
  const denied = ACTION_CAPABILITIES.filter((capability) => host[capability] !== true);

  return Object.freeze({
    schema_version: 'nolane.nui-host-envelope.v1',
    evidence_class: taskProfile.evidence_class,
    task_profile_checksum_sha256: taskProfile.checksum_sha256,
    nui: Object.freeze({
      repository: NUI_REPOSITORY,
      revision: NUI_V10_REVISION,
      projection: 'generic-cli',
      canonical_skill: nuiInstallPlan.canonical_skill,
      canonical_graph: nuiInstallPlan.canonical_graph,
      mode: FLAGSHIP_AMBITIONS.has(taskProfile.visual_ambition) ? 'flagship' : taskProfile.visual_ambition,
      copy_policy: 'canonical-reference-only',
    }),
    authority: Object.freeze({
      host_authoritative: true,
      authority_escalation: false,
      allowed_capabilities: Object.freeze(allowed),
      denied_capabilities: Object.freeze(denied),
    }),
    capability_evidence: capabilityEvidence(host),
    route_justification_ledger: Object.freeze({ selected, inactive_high_impact: inactive }),
    omission_declaration: omissionDeclaration,
    flagship_visual_synthesis: flagshipContract(taskProfile),
    lifecycle: Object.freeze({
      states: 'INTAKE→CONTRACTED→ROUTED→DISCOVERED→ARCHITECTED→DIVERGED→DESIGN_SELECTED→SYSTEMIZED→SPECIFIED→IMPLEMENTABLE→RENDERED→CRITIQUED→VERIFIED→RELEASED',
      exception_states: Object.freeze(['RECOVERY', 'BLOCKED']),
      phase_transition_requires_evidence: true,
    }),
    completion: Object.freeze({
      generator_ceiling: 'CRITIQUED',
      generator_may_verify: false,
      independent_verification_required: true,
      missing_evidence_state: 'UNKNOWN',
    }),
  });
}

export function assertSafeNuiEnvelope(envelope) {
  if (!envelope || envelope.schema_version !== 'nolane.nui-host-envelope.v1') throw new TypeError('valid nui-host-envelope is required');
  if (envelope.nui?.revision !== NUI_V10_REVISION) throw new TypeError('NUI envelope revision does not match the reviewed v10 revision');
  if (envelope.authority?.host_authoritative !== true || envelope.authority?.authority_escalation !== false) {
    throw new TypeError('NUI envelope attempted authority escalation');
  }
  if (envelope.completion?.generator_may_verify !== false) throw new TypeError('NUI envelope attempted generator self-certification');
  if (envelope.completion?.independent_verification_required !== true) throw new TypeError('NUI envelope must require independent verification');
  return envelope;
}

export function formatNuiEnvelopeForPrompt(envelope) {
  assertSafeNuiEnvelope(envelope);
  const allowed = Array.isArray(envelope.authority.allowed_capabilities) ? envelope.authority.allowed_capabilities.join(',') : '';
  const denied = Array.isArray(envelope.authority.denied_capabilities) ? envelope.authority.denied_capabilities.join(',') : '';
  const flagship = envelope.flagship_visual_synthesis;
  return [
    '[nui-host-envelope]',
    `revision=${envelope.nui.revision}`,
    `mode=${envelope.nui.mode}`,
    `task_profile_checksum_sha256=${envelope.task_profile_checksum_sha256}`,
    `host_authoritative=${envelope.authority.host_authoritative}`,
    `authority_escalation=${envelope.authority.authority_escalation}`,
    `allowed_capabilities=${allowed}`,
    `denied_capabilities=${denied}`,
    `generator_ceiling=${envelope.completion.generator_ceiling}`,
    `generator_may_verify=${envelope.completion.generator_may_verify}`,
    `independent_verification_required=${envelope.completion.independent_verification_required}`,
    ...(flagship ? [
      `minimum_divergent_directions=${flagship.minimum_divergent_directions}`,
      `minimum_closed_critique_cycles=${flagship.minimum_closed_critique_cycles}`,
      'flagship_visual_synthesis_required=true',
    ] : []),
    'NUI is advisory cognition. Host sandbox, approvals, tool policy and permissions remain authoritative.',
  ].join('\n');
}
