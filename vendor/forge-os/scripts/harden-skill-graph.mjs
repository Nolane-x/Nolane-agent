import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { CANDIDATE_SKILL_IDS, CORE_SKILLS, DOMAIN_SKILLS } from '../config/skill-definitions.mjs';
import { SKILL_OVERRIDES } from '../config/skill-overrides.mjs';
import { skillFlow, skillTools } from '../config/skill-flow.mjs';

const root = path.resolve('skills');
const contracts = [];

function replaceSection(content, heading, nextHeading, body) {
  const start = content.indexOf(`${heading}\n`);
  const end = content.indexOf(`${nextHeading}\n`, start + heading.length);
  if (start < 0 || end < 0) throw new Error(`Cannot replace ${heading}`);
  return `${content.slice(0, start)}${heading}\n\n${body.trim()}\n\n${content.slice(end)}`;
}

async function harden(name, pack, kind, domain = null) {
  const folder = kind === 'core' ? path.join(root, 'core', pack, name) : path.join(root, 'domains', domain, name);
  const contractFile = path.join(folder, 'contract.json');
  const skillFile = path.join(folder, 'SKILL.md');
  const contract = JSON.parse(await readFile(contractFile, 'utf8'));
  const flow = skillFlow(name, pack, kind, domain);
  const tools = skillTools(name, pack, kind);
  contract.version = '0.2.0';
  contract.status = name === 'using-forge-os' || (SKILL_OVERRIDES[name]?.source === 'flagship' && !CANDIDATE_SKILL_IDS.includes(name)) ? 'stable' : 'candidate';
  contract.stages = flow.stages;
  contract.consumes = flow.consumes;
  contract.optionalConsumes = flow.optionalConsumes ?? [];
  contract.produces = flow.produces;
  contract.invalidates = flow.produces.map((output) => `downstream:${output}`);
  contract.requiredTools = tools.requiredTools;
  contract.optionalTools = tools.optionalTools;
  contract.tools = tools.requiredTools;
  contract.handoff.next = { mode: 'graph-router', outputTypes: flow.produces };

  let content = await readFile(skillFile, 'utf8');
  content = content.replace(/(^\s*version:\s*)"?[0-9.]+"?/m, '$1"0.2.0"');
  content = content.replace(/(^\s*status:\s*)[a-z-]+/m, `$1${contract.status}`);
  contract.description = /^description:\s*"(.*)"$/m.exec(content)?.[1] ?? `Use when ${name} is required.`;
  const inputBody = [
    ...flow.consumes.map((item) => `- \`${item}\``),
    ...flow.optionalConsumes.map((item) => `- Optional: \`${item}\``),
    '- Current gate result, open findings, artifact hashes, and invalidation state',
    `- Required tools: ${tools.requiredTools.length ? tools.requiredTools.map((item) => `\`${item}\``).join(', ') : 'none'}`,
    `- Optional tools: ${tools.optionalTools.length ? tools.optionalTools.map((item) => `\`${item}\``).join(', ') : 'none'}`,
    '- Confirmed human decisions relevant to this scope',
  ].join('\n');
  content = replaceSection(content, '## Required Inputs', '## Method-Specific Protocol', inputBody);
  const outputBody = [
    'Produce:',
    ...flow.produces.map((item) => `- \`${item}\``),
    '',
    'The primary artifact must include schema version, provenance, consumed artifact IDs, decisions, evidence references, residual risks, validation state, and invalidation targets. Narrative explanation may accompany the artifact but cannot replace it.',
  ].join('\n');
  content = replaceSection(content, '## Output Contract', '## Quality Gate', outputBody);
  const handoffBody = [
    `- Next transition: the graph router selects a real consumer of ${flow.produces.map((item) => `\`${item}\``).join(', ')}.`,
    `- Required evidence: ${contract.handoff.requiredEvidence.map((item) => `\`${item}\``).join(', ')}.`,
    `- Required envelope fields: ${contract.handoff.requiredFields.map((item) => `\`${item}\``).join(', ')}.`,
    `- Stop condition: ${contract.handoff.stopWhen}`,
  ].join('\n');
  content = replaceSection(content, '## Handoff', '## Token and Context Policy', handoffBody);
  contract.context.estimatedTokens = Math.max(1, Math.ceil(content.length / 4));
  await writeFile(skillFile, content, 'utf8');
  await writeFile(contractFile, `${JSON.stringify(contract, null, 2)}\n`, 'utf8');
  contracts.push(contract);
}

for (const [pack, names] of Object.entries(CORE_SKILLS)) for (const name of names) await harden(name, pack, 'core');
for (const [domain, names] of Object.entries(DOMAIN_SKILLS)) for (const name of names) await harden(name, 'domain', 'domain', domain);
await writeFile(path.join(root, 'catalog.json'), `${JSON.stringify(contracts, null, 2)}\n`, 'utf8');
console.log(`Hardened ${contracts.length} skill contracts into a typed graph.`);
