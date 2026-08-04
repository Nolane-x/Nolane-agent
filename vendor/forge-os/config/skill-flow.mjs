const hasAny = (name, words) => words.some((word) => name.includes(word));

export const EXTERNAL_SKILL_INPUTS = Object.freeze([
  'project-state','gate-state','confirmed-intent','domain-context','behavioral-baseline','candidate-change',
]);

export const TERMINAL_SKILL_OUTPUTS = Object.freeze([
  'release-dossier','routing-decision','context-pack','approval-request','audit-record','recovery-report',
  'skill-evaluation','adapter-certification','domain-evidence','security-release-decision','incident-report',
]);

function kernelFlow(name) {
  const output = name === 'compiling-context-pack' ? 'context-pack'
    : name === 'requesting-human-decisions' ? 'approval-request'
      : name === 'auditing-agent-actions' ? 'audit-record'
        : name === 'recovering-interrupted-runs' ? 'recovery-report'
          : 'routing-decision';
  return { stages: ['intent','discovery','research','divergence','synthesis','selection','product-definition','ux-design','architecture','planning','implementation','verification','release-readiness'], consumes: ['project-state','gate-state'], optionalConsumes: ['confirmed-intent'], produces: [output] };
}

function researchFlow(name) {
  if (name === 'scoping-product-research') return { stages: ['discovery'], consumes: ['confirmed-intent'], produces: ['research-questions','problem-discovery'] };
  if (hasAny(name, ['synthesizing','validating-source','maintaining-prior'])) return { stages: ['research'], consumes: ['research-evidence','problem-discovery'], produces: ['research-synthesis'] };
  return { stages: ['discovery','research'], consumes: ['confirmed-intent'], optionalConsumes: ['research-questions'], produces: ['research-evidence','problem-discovery'] };
}

function creativityFlow(name) {
  if (name === 'framing-creative-challenge') return { stages: ['divergence'], consumes: ['research-synthesis'], produces: ['creative-brief'] };
  if (hasAny(name, ['clustering-semantic','detecting-fake','scoring-contextual'])) return { stages: ['synthesis'], consumes: ['candidate-ideas'], produces: ['scored-ideas'] };
  return { stages: ['divergence'], consumes: ['creative-brief'], produces: ['candidate-ideas'] };
}

function productFlow(name) {
  if (name === 'selecting-winning-concept') return { stages: ['selection'], consumes: ['scored-ideas'], produces: ['selected-concept'] };
  return { stages: ['product-definition'], consumes: ['selected-concept'], produces: ['product-definition','product-thesis','capability-map'] };
}

function uxFlow(name) {
  if (name === 'eliciting-user-workflows') return { stages: ['ux-design'], consumes: ['product-definition'], produces: ['user-workflows'] };
  return { stages: ['ux-design'], consumes: ['product-definition','user-workflows'], produces: ['ux-contract'] };
}

function architectureFlow(name) {
  if (hasAny(name, ['choosing-system','decomposing-bounded','defining-domain-model'])) {
    return { stages: ['architecture'], consumes: ['product-definition','ux-contract'], optionalConsumes: ['domain-blueprint','product-thesis','capability-map'], produces: ['system-boundaries','architecture-decision'] };
  }
  return { stages: ['architecture'], consumes: ['system-boundaries','product-definition'], optionalConsumes: ['ux-contract','domain-blueprint'], produces: ['architecture-decision'] };
}

function planningFlow() {
  return { stages: ['planning'], consumes: ['architecture-decision','threat-model'], optionalConsumes: ['product-definition','domain-blueprint'], produces: ['execution-plan','acceptance-contracts'] };
}

function implementationFlow(name) {
  if (hasAny(name, ['reviewing-code','reviewing-critical','refactoring-with','documenting-public'])) {
    return { stages: ['implementation'], consumes: ['implemented-increment'], optionalConsumes: ['acceptance-contracts'], produces: ['verified-build'] };
  }
  return { stages: ['implementation'], consumes: ['execution-plan','acceptance-contracts'], produces: ['implemented-increment'] };
}

function qualityFlow(name) {
  if (name.startsWith('designing-')) return { stages: ['verification'], consumes: ['verified-build','acceptance-contracts'], produces: ['test-plan'] };
  return { stages: ['verification'], consumes: ['test-plan','verified-build'], optionalConsumes: ['domain-evidence'], produces: ['verification-report','ux-evidence'] };
}

function securityFlow(name) {
  if (hasAny(name, ['modeling-security-threats','reviewing-secure-design'])) {
    return { stages: ['architecture'], consumes: ['system-boundaries','product-definition'], produces: ['threat-model'] };
  }
  if (name === 'running-security-release-gate') {
    return { stages: ['release-readiness'], consumes: ['verification-report','security-review'], produces: ['security-release-decision'] };
  }
  return { stages: ['verification'], consumes: ['threat-model','verified-build'], produces: ['security-review'] };
}

function operationsFlow(name) {
  if (name === 'packaging-release-evidence') {
    return { stages: ['release-readiness'], consumes: ['verification-report','security-review','operations-evidence'], optionalConsumes: ['security-release-decision','deployment-plan','ux-evidence'], produces: ['release-dossier'] };
  }
  if (name === 'triaging-production-incidents') return { stages: ['released'], consumes: ['project-state'], produces: ['incident-report'] };
  return { stages: ['implementation','verification','release-readiness'], consumes: ['verified-build'], optionalConsumes: ['architecture-decision'], produces: ['deployment-plan','operations-evidence'] };
}

function metaFlow(name) {
  return { stages: ['discovery','planning','implementation','verification'], consumes: ['behavioral-baseline','candidate-change'], produces: [name === 'certifying-platform-adapters' ? 'adapter-certification' : 'skill-evaluation'] };
}

export function skillFlow(name, pack, kind, domain = null) {
  if (kind === 'domain') return {
    stages: ['product-definition','ux-design','architecture','planning','implementation','verification','release-readiness'],
    consumes: ['product-definition'], optionalConsumes: ['architecture-decision','verified-build'], produces: ['domain-blueprint','domain-evidence'],
  };
  const flow = ({ kernel: kernelFlow, research: researchFlow, creativity: creativityFlow, product: productFlow, ux: uxFlow,
    architecture: architectureFlow, planning: planningFlow, implementation: implementationFlow, quality: qualityFlow,
    security: securityFlow, operations: operationsFlow, meta: metaFlow })[pack]?.(name);
  if (!flow) throw new Error(`No skill flow for ${pack}:${name}`);
  return { optionalConsumes: [], ...flow };
}

export function skillTools(name, pack, kind) {
  const required = [];
  const optional = [];
  if (pack === 'research' && hasAny(name, ['mapping-existing','analyzing-competing','identifying-market','maintaining-prior'])) required.push('web-search');
  if (pack === 'implementation') required.push('filesystem','shell');
  if (pack === 'quality') required.push('test-runner');
  if (pack === 'security' && hasAny(name, ['scanning-dependency','securing-software-supply'])) required.push('security-scanner');
  if (pack === 'ux' && hasAny(name, ['prototyping','visual','interface','responsive','accessibility'])) optional.push('browser');
  if (pack === 'operations') optional.push('shell','container-runtime');
  if (kind === 'domain' && hasAny(name, ['testing-','monitoring-'])) optional.push('test-runner');
  return { requiredTools: [...new Set(required)], optionalTools: [...new Set(optional)] };
}
