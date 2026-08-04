import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { artifactHash, createArtifact } from '../src/core/artifacts.mjs';
import { buildArtifactGraph } from '../src/core/graph.mjs';
import { ProjectStore } from '../src/core/project-store.mjs';
import { ForgeOrchestrator } from '../src/core/orchestrator.mjs';
import { createPrincipal } from '../src/core/principals.mjs';
import { createTestEvidenceRegistry } from './helpers/trusted-evidence.mjs';

const worker = createPrincipal({ id: 'worker-1', type: 'agent', roles: ['worker'], trustDomain:'team:build' });
const reviewer = createPrincipal({ id: 'reviewer-1', type: 'human', roles: ['reviewer'], trustDomain:'team:review' });

const artifactInput = (overrides = {}) => ({
  type: 'problem-discovery',
  schemaVersion: '1.0.0',
  content: { problem: 'Teams cannot prove agent-generated changes are safe.' },
  producedBy: { skill: 'extracting-user-pain' },
  consumes: [], decisions: [], evidence: [], residualRisks: [],
  ...overrides,
});

test('artifact hash is canonical for nested JSON key order', () => {
  const common = { type: 'problem-discovery', schemaVersion: '1.0.0', version: 1, consumes: [], decisions: [] };
  const first = artifactHash({ ...common, content: { a: 1, nested: { x: 1, y: 2 } } });
  const second = artifactHash({ ...common, content: { nested: { y: 2, x: 1 }, a: 1 } });
  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
});

test('artifact graph rejects missing dependencies and cycles', () => {
  assert.throws(() => buildArtifactGraph([{ id: 'a', consumes: ['missing'] }]), /missing dependency/i);
  assert.throws(() => buildArtifactGraph([{ id: 'a', consumes: ['b'] }, { id: 'b', consumes: ['a'] }]), /cycle/i);
});

test('runtime rejects duplicate IDs and multiple active versions without supersession', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-artifact-unique-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const forge = new ForgeOrchestrator(new ProjectStore(dir),{evidenceProviders:createTestEvidenceRegistry(dir)});
  const project = await forge.createProject({ name: 'Artifacts' });
  await forge.saveArtifact(project.id, { id: 'artifact_problem', ...artifactInput() }, { principal: worker });
  await assert.rejects(() => forge.saveArtifact(project.id, { id: 'artifact_problem', ...artifactInput() }, { principal: worker }), /duplicate artifact id/i);
  await assert.rejects(() => forge.saveArtifact(project.id, artifactInput(), { principal: worker }), /active artifact.*problem-discovery/i);
});

test('runtime rejects missing dependency before writing state', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-artifact-dep-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const forge = new ForgeOrchestrator(new ProjectStore(dir),{evidenceProviders:createTestEvidenceRegistry(dir)});
  const project = await forge.createProject({ name: 'Dependencies' });
  await assert.rejects(() => forge.saveArtifact(project.id, artifactInput({ consumes: ['artifact_missing'] }), { principal: worker }), /missing dependency/i);
  assert.equal((await forge.getProject(project.id)).artifacts.length, 0);
});

test('tampered artifact content is detected on read', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-artifact-tamper-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new ProjectStore(dir);
  const forge = new ForgeOrchestrator(store);
  const project = await forge.createProject({ name: 'Tamper' });
  await forge.saveArtifact(project.id, artifactInput(), { principal: worker });
  const file = path.join(dir, `${project.id}.json`);
  const data = JSON.parse(await readFile(file, 'utf8'));
  data.artifacts[0].content.problem = 'attacker changed the artifact';
  await writeFile(file, JSON.stringify(data));
  await assert.rejects(() => store.read(project.id), /hash mismatch/i);
});

test('public artifact lifecycle reviews, verifies, supersedes, and invalidates descendants', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'forge-artifact-life-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const forge = new ForgeOrchestrator(new ProjectStore(dir),{evidenceProviders:createTestEvidenceRegistry(dir)});
  const project = await forge.createProject({ name: 'Lifecycle' });
  let state = await forge.saveArtifact(project.id, { id: 'artifact_problem', ...artifactInput() }, { principal: worker });
  const first = state.artifacts[0];
  await forge.requestEvidence(project.id,{id:'evidence_review',providerId:'test-command',recipeId:'pass',type:'artifact-review',title:'Independent artifact review',subject:{artifactId:first.id,artifactSha256:first.sha256}},{principal:reviewer});
  state = await forge.reviewArtifact(project.id, first.id, { notes: 'Contract complete.' }, { principal: reviewer });
  assert.equal(state.artifacts[0].state, 'review');
  state = await forge.verifyArtifact(project.id, first.id, { evidence: ['evidence_review'] }, { principal: reviewer });
  assert.equal(state.artifacts[0].state, 'verified');

  state = await forge.saveArtifact(project.id, {
    id: 'artifact_research', type: 'research-synthesis', schemaVersion: '1.0.0',
    content: { findings: ['Evidence labels are not proof.'] }, producedBy: { skill: 'synthesizing-product-evidence' },
    consumes: ['artifact_problem'], decisions: [], evidence: [], residualRisks: [],
  }, { principal: worker });
  assert.equal(state.artifacts.find((item) => item.id === 'artifact_research').state, 'draft');

  state = await forge.supersedeArtifact(project.id, first.id, {
    id: 'artifact_problem_v2', ...artifactInput({ content: { problem: 'Teams need revision-bound proof for agent changes.' } }),
  }, { principal: worker });
  assert.equal(state.artifacts.find((item) => item.id === first.id).state, 'superseded');
  assert.equal(state.artifacts.find((item) => item.id === 'artifact_research').state, 'invalidated');
  assert.equal(state.artifacts.find((item) => item.id === 'artifact_problem_v2').state, 'draft');
});

test('createArtifact records server-derived principal provenance', () => {
  const artifact = createArtifact({ projectId: 'forge_abc123', ...artifactInput() }, { id: 'artifact_a', now: '2026-07-24T00:00:00.000Z', principal: worker });
  assert.equal(artifact.producedBy.principalId, 'worker-1');
  assert.equal(artifact.producedBy.principalType, 'agent');
  assert.equal('agent' in artifact.producedBy, false);
});

test('artifact verification rejects an invented or stale gate reference',async(t)=>{
  const dir=await mkdtemp(path.join(tmpdir(),'forge-artifact-gate-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const forge=new ForgeOrchestrator(new ProjectStore(dir),{evidenceProviders:createTestEvidenceRegistry(dir)});
  const project=await forge.createProject({name:'Gate reference'});
  let state=await forge.saveArtifact(project.id,{id:'artifact_problem',...artifactInput()},{principal:worker});
  const artifact=state.artifacts[0];
  state=await forge.requestEvidence(project.id,{id:'evidence_review',providerId:'test-command',recipeId:'pass',type:'artifact-review',title:'Review',subject:{artifactId:artifact.id,artifactSha256:artifact.sha256}},{principal:reviewer});
  await forge.reviewArtifact(project.id,artifact.id,{notes:'Ready.'},{principal:reviewer});
  await assert.rejects(()=>forge.verifyArtifact(project.id,artifact.id,{evidence:['evidence_review'],gateId:'gate_invented'},{principal:reviewer}),/unknown gate/i);
});
