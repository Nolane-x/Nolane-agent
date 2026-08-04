import { boundedNumber, optionalText, signed, strings, text } from './construction-utils.mjs';

const CONSTRAINT_KINDS = new Set(['hard', 'negotiable']);
const SEVERITIES = new Set(['critical', 'high', 'warning', 'info']);

function uniqueRecords(items, idKey, label, normalize, max = 256) {
  if (!Array.isArray(items) || items.length > max) throw new TypeError(`${label} must be an array with at most ${max} items`);
  const ids = new Set();
  return items.map((item, index) => {
    if (!item || typeof item !== 'object') throw new TypeError(`${label}[${index}] must be an object`);
    const result = normalize(item, index);
    const id = result[idKey];
    if (ids.has(id)) throw new TypeError(`${label} contains duplicate id: ${id}`);
    ids.add(id);
    return result;
  });
}

function contradictionFindings(constraints) {
  const rules = new Set(constraints.filter((item) => item.kind === 'hard').map((item) => item.rule).filter(Boolean));
  const conflicts = [];
  const pairs = [
    ['preserve-public-api', 'rename-public-api-without-adapter', 'Public API compatibility conflicts with an adapter-free rename.'],
    ['no-schema-change', 'change-schema', 'Schema preservation conflicts with a required schema change.'],
    ['no-new-dependency', 'add-dependency', 'Dependency freeze conflicts with adding a dependency.'],
  ];
  for (const [left, right, message] of pairs) {
    if (rules.has(left) && rules.has(right)) conflicts.push(signed({ schema: 'forge.specification-conflict.v1', kind: 'hard-constraint-conflict', rules: [left, right], message }));
  }
  return conflicts;
}

export function compileSpecification(input = {}) {
  if (!input || typeof input !== 'object') throw new TypeError('specification input must be an object');
  const specificationId = text(input.specificationId, 'specificationId', 256);
  const goal = text(input.goal, 'goal', 8_000);
  const verificationPlan = uniqueRecords(input.verificationPlan ?? [], 'verificationId', 'verificationPlan', (item, index) => ({
    verificationId: text(item.verificationId, `verificationPlan[${index}].verificationId`, 256),
    criterionIds: strings(item.criterionIds, `verificationPlan[${index}].criterionIds`, 128, 256),
    kind: text(item.kind, `verificationPlan[${index}].kind`, 128),
    required: item.required !== false,
  }));
  const verificationIdsByCriterion = new Map();
  for (const verification of verificationPlan) for (const criterionId of verification.criterionIds) {
    const list = verificationIdsByCriterion.get(criterionId) ?? [];
    list.push(verification.verificationId);
    verificationIdsByCriterion.set(criterionId, list);
  }
  const criteria = uniqueRecords(input.criteria ?? [], 'criterionId', 'criteria', (item, index) => {
    const criterionId = text(item.criterionId, `criteria[${index}].criterionId`, 256);
    return {
      criterionId,
      statement: text(item.statement, `criteria[${index}].statement`, 4_000),
      weight: boundedNumber(item.weight, 1, 0.1, 100, `criteria[${index}].weight`),
      verificationIds: [...(verificationIdsByCriterion.get(criterionId) ?? [])],
    };
  });
  if (!criteria.length) throw new TypeError('criteria must contain at least one item');
  const criterionIds = new Set(criteria.map((item) => item.criterionId));
  for (const verification of verificationPlan) for (const criterionId of verification.criterionIds) if (!criterionIds.has(criterionId)) throw new TypeError(`verification references unknown criterion: ${criterionId}`);
  const constraints = uniqueRecords(input.constraints ?? [], 'constraintId', 'constraints', (item, index) => {
    const kind = text(item.kind, `constraints[${index}].kind`, 64);
    if (!CONSTRAINT_KINDS.has(kind)) throw new TypeError(`unsupported constraint kind: ${kind}`);
    return { constraintId: text(item.constraintId, `constraints[${index}].constraintId`, 256), kind, statement: text(item.statement, `constraints[${index}].statement`, 4_000), rule: optionalText(item.rule, 256) || null };
  });
  const interfaces = uniqueRecords(input.interfaces ?? [], 'interfaceId', 'interfaces', (item, index) => ({
    interfaceId: text(item.interfaceId, `interfaces[${index}].interfaceId`, 256),
    path: text(item.path, `interfaces[${index}].path`, 1_024),
    compatibility: optionalText(item.compatibility, 128) || 'unspecified',
  }));
  const invariants = uniqueRecords(input.invariants ?? [], 'invariantId', 'invariants', (item, index) => {
    const severity = text(item.severity, `invariants[${index}].severity`, 64);
    if (!SEVERITIES.has(severity)) throw new TypeError(`unsupported invariant severity: ${severity}`);
    return { invariantId: text(item.invariantId, `invariants[${index}].invariantId`, 256), severity, statement: text(item.statement, `invariants[${index}].statement`, 4_000), verifierId: text(item.verifierId, `invariants[${index}].verifierId`, 256) };
  });
  const conflicts = contradictionFindings(constraints);
  const status = conflicts.length ? 'blocked' : 'ready';
  return signed({
    schema: 'forge.construction-specification.v1', specificationId, goal, criteria,
    nonGoals: strings(input.nonGoals ?? [], 'nonGoals', 256, 4_000), constraints, interfaces, invariants,
    affectedComponents: strings(input.affectedComponents ?? [], 'affectedComponents', 256, 512),
    migrationRequirements: strings(input.migrationRequirements ?? [], 'migrationRequirements', 128, 4_000),
    securityRequirements: strings(input.securityRequirements ?? [], 'securityRequirements', 128, 4_000),
    performanceRequirements: strings(input.performanceRequirements ?? [], 'performanceRequirements', 128, 4_000),
    verificationPlan, conflicts, status, editAuthorized: status === 'ready',
    claims: { modelGenerated: false, contradictionsChecked: true, directFileMutation: false },
  });
}

export class SpecificationConflictError extends Error {
  constructor(specification) {
    super('Specification contains blocking conflicts');
    this.name = 'SpecificationConflictError';
    this.code = 'SPECIFICATION_CONFLICT';
    this.specification = specification;
  }
}
