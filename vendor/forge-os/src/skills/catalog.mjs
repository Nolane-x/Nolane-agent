import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORE_PACKS, DOMAIN_PACKS, STAGES, ASSURANCE_LEVELS, SKILL_STATUSES } from '../core/constants.mjs';
import { EXTERNAL_SKILL_INPUTS, TERMINAL_SKILL_OUTPUTS } from '../../config/skill-flow.mjs';
import { validateRuntimeSchema } from '../core/runtime-schemas.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../skills');
const CACHE = new Map();

function skillFolder(root, contract) {
  return contract.kind === 'core'
    ? path.join(root, 'core', contract.pack, contract.name)
    : path.join(root, 'domains', contract.domain, contract.name);
}

function parseFrontmatter(content, source) {
  content = content.replace(/\r\n?/g, '\n');
  if (!content.startsWith('---\n')) throw new Error(`${source}: missing YAML frontmatter`);
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) throw new Error(`${source}: unterminated YAML frontmatter`);
  const data = {};
  let section = null;
  for (const raw of content.slice(4, end).split('\n')) {
    if (!raw.trim()) continue;
    const nested = /^\s{2}([A-Za-z0-9_-]+):\s*"?(.*?)"?\s*$/.exec(raw);
    if (nested && section) {
      data[section] ??= {};
      data[section][nested[1]] = nested[2].replace(/^"|"$/g, '');
      continue;
    }
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(raw);
    if (!match) continue;
    section = match[1];
    const value = match[2].replace(/^"|"$/g, '');
    data[section] = value === '' ? {} : value;
  }
  return { frontmatter: data, body: content.slice(end + 5) };
}

async function metadataCatalog(root, refresh) {
  const catalogFile = path.join(root, 'catalog.json');
  const info = await stat(catalogFile);
  const cacheKey = path.resolve(root);
  const cached = CACHE.get(cacheKey);
  if (!refresh && cached?.mtimeMs === info.mtimeMs) return cached.skills;
  const contracts = JSON.parse(await readFile(catalogFile, 'utf8'));
  for (const contract of contracts) validateRuntimeSchema('skill', contract);
  const skills = contracts.map((contract) => {
    const folder = skillFolder(root, contract);
    return {
      slug: contract.name,
      name: contract.name,
      description: contract.description ?? `Use when ${contract.name} is required.`,
      metadata: { version: contract.version, pack: contract.pack, kind: contract.kind, status: contract.status },
      file: path.join(folder, 'SKILL.md'),
      contractFile: path.join(folder, 'contract.json'),
      contract,
    };
  });
  CACHE.set(cacheKey, { mtimeMs: info.mtimeMs, skills });
  return skills;
}

async function hydrate(skill) {
  const content = await readFile(skill.file, 'utf8');
  const parsed = parseFrontmatter(content, skill.file);
  return { ...skill, description: parsed.frontmatter.description ?? skill.description, metadata: parsed.frontmatter.metadata ?? skill.metadata, body: parsed.body, content };
}

export async function loadSkillCatalog(root = ROOT, { includeBody = false, refresh = false } = {}) {
  const skills = await metadataCatalog(path.resolve(root), refresh);
  return includeBody ? Promise.all(skills.map(hydrate)) : skills.map((skill) => ({ ...skill }));
}

export async function getSkill(name, root = ROOT) {
  const skill = (await loadSkillCatalog(root)).find((item) => item.name === name || item.slug === name);
  if (!skill) throw new Error(`Unknown skill: ${name}`);
  return hydrate(skill);
}

export function validateSkillCatalog(catalog) {
  const errors = [];
  const names = new Set();
  const producedBy = new Map();
  const consumedBy = new Map();
  for (const skill of catalog) {
    const c = skill.contract ?? {};
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name ?? '')) errors.push(`${skill.slug}: invalid name`);
    if (skill.name !== c.name) errors.push(`${skill.slug}: metadata/contract name mismatch`);
    if (names.has(skill.name)) errors.push(`${skill.slug}: duplicate name`);
    names.add(skill.name);
    if (!skill.description?.startsWith('Use when')) errors.push(`${skill.slug}: description must start with Use when`);
    if ((skill.description?.length ?? 0) > 1024) errors.push(`${skill.slug}: description too long`);
    if (skill.body) {
      for (const section of ['## Trigger','## Required Inputs','## Method-Specific Protocol','## Procedure','## Verification Questions','## Evidence Packet','## Output Contract','## Quality Gate','## Forbidden Shortcuts','## Escalation and Invalidation','## Handoff','## Token and Context Policy']) {
        if (!skill.body.includes(section)) errors.push(`${skill.slug}: missing ${section}`);
      }
    }
    if (!['core','domain'].includes(c.kind)) errors.push(`${skill.slug}: invalid kind`);
    if (c.kind === 'core' && !CORE_PACKS.includes(c.pack)) errors.push(`${skill.slug}: invalid core pack`);
    if (c.kind === 'domain' && !DOMAIN_PACKS.includes(c.domain)) errors.push(`${skill.slug}: invalid domain`);
    if (!SKILL_STATUSES.includes(c.status)) errors.push(`${skill.slug}: invalid status`);
    if (!Array.isArray(c.stages) || !c.stages.length || c.stages.some((stage) => !STAGES.includes(stage))) errors.push(`${skill.slug}: invalid stages`);
    if (!Array.isArray(c.assurance) || !c.assurance.length || c.assurance.some((level) => !ASSURANCE_LEVELS.includes(level))) errors.push(`${skill.slug}: invalid assurance`);
    if (!Array.isArray(c.consumes) || !c.consumes.length) errors.push(`${skill.slug}: missing consumes`);
    if (!Array.isArray(c.optionalConsumes)) errors.push(`${skill.slug}: optionalConsumes must be an array`);
    if (!Array.isArray(c.produces) || !c.produces.length) errors.push(`${skill.slug}: missing produces`);
    if (!Array.isArray(c.requiredTools) || !Array.isArray(c.optionalTools)) errors.push(`${skill.slug}: tool contracts are incomplete`);
    if (!Array.isArray(c.procedure) || c.procedure.length < 9) errors.push(`${skill.slug}: procedure too small`);
    if (!c.reference?.startsWith('skills/references/')) errors.push(`${skill.slug}: missing reference playbook`);
    if (!c.method?.focus || !Array.isArray(c.method?.steps) || c.method.steps.length < 5) errors.push(`${skill.slug}: method protocol too weak`);
    if (!Array.isArray(c.method?.verification) || c.method.verification.length < 3) errors.push(`${skill.slug}: verification questions too weak`);
    if (!Array.isArray(c.method?.evidence) || c.method.evidence.length < 2) errors.push(`${skill.slug}: evidence packet too weak`);
    if (!Array.isArray(c.gate?.rules) || c.gate.rules.length < 4) errors.push(`${skill.slug}: gate too weak`);
    if (c.handoff?.next?.mode !== 'graph-router' || !Array.isArray(c.handoff?.next?.outputTypes)) errors.push(`${skill.slug}: handoff is not graph-routable`);
    if (!c.handoff?.stopWhen || !Array.isArray(c.handoff?.requiredFields) || c.handoff.requiredFields.length < 8) errors.push(`${skill.slug}: incomplete handoff`);
    if (!Number.isFinite(c.context?.estimatedTokens) || c.context.estimatedTokens <= 0) errors.push(`${skill.slug}: invalid context estimate`);
    for (const output of c.produces ?? []) {
      if (!producedBy.has(output)) producedBy.set(output, []);
      producedBy.get(output).push(skill.name);
    }
    for (const input of [...(c.consumes ?? []), ...(c.optionalConsumes ?? [])]) {
      if (!consumedBy.has(input)) consumedBy.set(input, []);
      consumedBy.get(input).push(skill.name);
    }
  }
  const external = new Set(EXTERNAL_SKILL_INPUTS);
  const terminal = new Set(TERMINAL_SKILL_OUTPUTS);
  const unresolvedInputs = [...consumedBy.keys()].filter((input) => !producedBy.has(input) && !external.has(input)).sort();
  const orphanOutputs = [...producedBy.keys()].filter((output) => !consumedBy.has(output) && !terminal.has(output)).sort();
  for (const input of unresolvedInputs) errors.push(`unresolved skill input: ${input}`);
  for (const output of orphanOutputs) errors.push(`orphan skill output: ${output}`);
  let edgeCount = 0;
  for (const [output, producers] of producedBy) edgeCount += producers.length * (consumedBy.get(output)?.length ?? 0);
  const root = catalog.find((skill) => skill.name === 'using-forge-os');
  if (!root) errors.push('missing ForgeOS root routing protocol');
  for (const pack of CORE_PACKS) if (!catalog.some((skill) => skill.contract.kind === 'core' && skill.contract.pack === pack)) errors.push(`missing core pack ${pack}`);
  for (const domain of DOMAIN_PACKS) if (!catalog.some((skill) => skill.contract.kind === 'domain' && skill.contract.domain === domain)) errors.push(`missing domain pack ${domain}`);
  return {
    errors, count: catalog.length,
    coreCount: catalog.filter((skill) => skill.contract.kind === 'core').length,
    domainCount: catalog.filter((skill) => skill.contract.kind === 'domain').length,
    producedCount: producedBy.size, consumedCount: consumedBy.size, edgeCount, unresolvedInputs, orphanOutputs,
  };
}
