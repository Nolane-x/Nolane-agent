import test from 'node:test';
import assert from 'node:assert/strict';
import { RepositoryIntelligenceFabric } from '../src/repository/repository-intelligence-fabric.mjs';

function frozen(value) { return Object.freeze(value); }

function createHarness() {
  const created = { context: 0, vectors: 0, repository: 0, program: 0, variables: 0, ablator: 0, runtime: 0 };
  let vectorClosed = 0;
  const completionFactories = {
    context: () => { created.context += 1; return {
      expandQueries: async (input) => frozen({ schema: 'context-expand', input }),
      recordVerifiedOutcome: (input) => frozen({ schema: 'context-outcome', input }),
      runAblationReplay: async (input) => frozen({ schema: 'context-ablation', input }),
      snapshot: () => frozen({ schema: 'context-snapshot' }),
    }; },
    vectors: () => { created.vectors += 1; return {
      build: async (input) => frozen({ schema: 'vector-build', input }),
      search: async (input) => frozen({ schema: 'vector-search', input }),
      snapshot: () => frozen({ schema: 'vector-snapshot' }),
      async close() { vectorClosed += 1; },
    }; },
    repository: () => { created.repository += 1; return {
      recordCommitArchitecture: (input) => frozen({ schema: 'commit-architecture', input }),
      recordIssueCodeReference: (input) => frozen({ schema: 'issue-reference', input }),
      buildModuleMap: (input) => frozen({ schema: 'module-map', input }),
      detectArchitectureZones: (input) => frozen({ schema: 'architecture-zones', input }),
      buildGitRiskProfile: (input) => frozen({ schema: 'git-risk', input }),
      snapshot: () => frozen({ schema: 'repository-completion-snapshot' }),
    }; },
    program: () => { created.program += 1; return {
      buildControlFlow: (input) => frozen({ schema: 'control-flow', input }),
      buildDataFlow: (input) => frozen({ schema: 'data-flow', input }),
      snapshot: () => frozen({ schema: 'program-snapshot' }),
    }; },
    variables: () => { created.variables += 1; return {
      registerBinding: (input) => frozen({ schema: 'variable-register', input }),
      transitionBinding: (bindingId, input) => frozen({ schema: 'variable-transition', bindingId, input }),
      resolve: (input) => frozen({ schema: 'variable-resolve', input }),
      snapshot: () => frozen({ schema: 'variable-snapshot' }),
    }; },
    ablator: () => { created.ablator += 1; return {
      run: async (input) => frozen({ schema: 'patch-ablation', input }),
    }; },
  };
  const fabric = new RepositoryIntelligenceFabric({
    runtimeFactory: () => {
      created.runtime += 1;
      return {
        repository: {},
        lexicalIndex: { search: () => [] },
        digitalTwin: {},
        async close() {},
      };
    },
    embeddingRegistry: { async status() { return { providers: [] }; }, async close() {} },
    polyglotPlane: { async status() { return { state: 'inactive' }; }, async close() {} },
    completionFactories,
  });
  return { fabric, created, vectorClosed: () => vectorClosed };
}

test('keeps intelligence completion services lazy on the repository fast path', async () => {
  const { fabric, created } = createHarness();
  await fabric.status();
  assert.deepEqual(created, { context: 0, vectors: 0, repository: 0, program: 0, variables: 0, ablator: 0, runtime: 0 });
  fabric.lexicalSearch('repo', 'needle');
  assert.equal(created.runtime, 1);
  assert.deepEqual({ ...created, runtime: 0 }, { context: 0, vectors: 0, repository: 0, program: 0, variables: 0, ablator: 0, runtime: 0 });
});

test('routes completion APIs to one lazily-created service per capability', async () => {
  const { fabric, created } = createHarness();
  assert.equal((await fabric.expandCompletionQueries({ objective: 'fix' })).schema, 'context-expand');
  assert.equal(fabric.recordCompletionContextOutcome({ verified: true }).schema, 'context-outcome');
  assert.equal((await fabric.runCompletionContextAblation({ evidenceCards: [] })).schema, 'context-ablation');
  assert.equal(fabric.completionContextSnapshot().schema, 'context-snapshot');
  assert.equal((await fabric.completionVectorBuild({ indexId: 'repo' })).schema, 'vector-build');
  assert.equal((await fabric.completionVectorSearch({ indexId: 'repo' })).schema, 'vector-search');
  assert.equal(fabric.recordCompletionCommitArchitecture({ repositoryId: 'repo' }).schema, 'commit-architecture');
  assert.equal(fabric.recordCompletionIssueReference({ repositoryId: 'repo' }).schema, 'issue-reference');
  assert.equal(fabric.completionModuleMap({ repositoryId: 'repo' }).schema, 'module-map');
  assert.equal(fabric.completionArchitectureZones({ repositoryId: 'repo' }).schema, 'architecture-zones');
  assert.equal(fabric.completionGitRisk({ repositoryId: 'repo' }).schema, 'git-risk');
  assert.equal(fabric.completionControlFlow({ functions: [] }).schema, 'control-flow');
  assert.equal(fabric.completionDataFlow({ functions: [] }).schema, 'data-flow');
  assert.equal(fabric.registerCompletionVariable({ bindingId: 'x' }).schema, 'variable-register');
  assert.equal(fabric.transitionCompletionVariable('x', { transitionId: 't' }).schema, 'variable-transition');
  assert.equal(fabric.resolveCompletionVariable({ symbol: 'x' }).schema, 'variable-resolve');
  assert.equal((await fabric.runCompletionPatchAblation({ candidateId: 'c' })).schema, 'patch-ablation');
  assert.deepEqual(created, { context: 1, vectors: 1, repository: 1, program: 1, variables: 1, ablator: 1, runtime: 0 });
});

test('reports loaded completion capabilities without forcing new instances and closes vector storage', async () => {
  const { fabric, created, vectorClosed } = createHarness();
  await fabric.completionVectorBuild({ indexId: 'repo' });
  fabric.completionControlFlow({ functions: [] });
  const snapshot = fabric.completionSnapshot();
  assert.deepEqual(snapshot.loaded, { context: false, vectors: true, repository: false, program: true, variables: false, ablator: false });
  assert.equal(snapshot.services.vectors.schema, 'vector-snapshot');
  assert.equal(snapshot.services.program.schema, 'program-snapshot');
  assert.equal(snapshot.services.context, null);
  assert.deepEqual(created, { context: 0, vectors: 1, repository: 0, program: 1, variables: 0, ablator: 0, runtime: 0 });
  await fabric.close();
  assert.equal(vectorClosed(), 1);
  await assert.rejects(() => fabric.completionVectorSearch({ indexId: 'repo' }), /closed/i);
  assert.throws(() => fabric.completionControlFlow({ functions: [] }), /closed/i);
});

test('does not wire completion modules through the application bootstrap', async () => {
  const appSource = await import('node:fs/promises').then(({ readFile }) => readFile(new URL('../src/app.mjs', import.meta.url), 'utf8'));
  assert.doesNotMatch(appSource, /intelligence-completion/);
});
