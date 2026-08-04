import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { loadFederationSources } from '../federation/source-registry.mjs';

const ID = /^[a-z0-9][a-z0-9-]{2,79}$/;
const EXECUTION_BOUNDARIES = new Set(['advisory-only','verified-artifact','human-approved-executor']);
const loadJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
function strings(value, label) {
  if (!Array.isArray(value) || !value.length || value.some((item) => typeof item !== 'string' || !item.trim()) || new Set(value).size !== value.length) throw new TypeError(`${label} must be a non-empty unique string array`);
  return Object.freeze(value.map((item) => item.trim()));
}

export function validateUniversalLaneRegistry(input, { skillIds, capabilityDomains, sourceIds } = {}) {
  if (input?.schemaVersion !== 1 || !Array.isArray(input.lanes) || input.lanes.length < 1 || input.lanes.length > 32) throw new TypeError('Universal lane registry schemaVersion 1 with 1-32 lanes is required');
  const seen = new Set();
  const lanes = input.lanes.map((lane) => {
    const id = String(lane?.id ?? '').trim();
    if (!ID.test(id) || seen.has(id)) throw new TypeError(`Invalid or duplicate universal lane id: ${id}`);
    seen.add(id);
    const title = String(lane.title ?? '').trim();
    const summary = String(lane.summary ?? '').trim();
    if (!title || !summary || title.length > 120 || summary.length > 500) throw new TypeError(`Universal lane ${id} needs bounded title and summary`);
    const domains = strings(lane.capabilityDomains, `${id}.capabilityDomains`);
    const skills = strings(lane.skillIds, `${id}.skillIds`);
    const sources = strings(lane.externalSourceIds, `${id}.externalSourceIds`);
    for (const domain of domains) if (!capabilityDomains?.has(domain)) throw new TypeError(`Universal lane ${id} references unknown capability domain: ${domain}`);
    for (const skill of skills) if (!skillIds?.has(skill)) throw new TypeError(`Universal lane ${id} references unknown skill: ${skill}`);
    for (const source of sources) if (!sourceIds?.has(source)) throw new TypeError(`Universal lane ${id} references unknown source: ${source}`);
    if (!EXECUTION_BOUNDARIES.has(lane.executionBoundary)) throw new TypeError(`Universal lane ${id} has an unsupported execution boundary`);
    return Object.freeze({ id, title, summary, capabilityDomains: domains, skillIds: skills, externalSourceIds: sources, executionBoundary: lane.executionBoundary });
  });
  const canonical = { schemaVersion: 1, lanes };
  return Object.freeze({ ...canonical, registrySha256: canonicalSha256(canonical) });
}

export async function loadUniversalLaneRegistry({ root = process.cwd(), sourcesLoader = loadFederationSources } = {}) {
  const absolute = path.resolve(root);
  const [input, skills, capabilities, sources] = await Promise.all([
    loadJson(path.join(absolute, 'config/universal-lanes.json')),
    loadJson(path.join(absolute, 'skills/catalog.json')),
    loadJson(path.join(absolute, 'capabilities/catalog.json')),
    sourcesLoader(),
  ]);
  return validateUniversalLaneRegistry(input, {
    skillIds: new Set(skills.map((skill) => skill.name)),
    capabilityDomains: new Set(capabilities.map((capability) => capability.domain)),
    sourceIds: new Set(sources.map((source) => source.id)),
  });
}
