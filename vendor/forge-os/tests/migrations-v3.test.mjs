import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalSha256 } from '../src/core/canonical-json.mjs';
import { migrateProject, planMigration } from '../src/core/migrations.mjs';
import { validateProjectAggregate } from '../src/core/project-validator.mjs';
import { validateRuntimeSchema } from '../src/core/runtime-schemas.mjs';

async function fixture(version,name){return JSON.parse(await readFile(new URL(`./fixtures/${version}/${name}`,import.meta.url),'utf8'));}

for (const [version,name] of [['v0.1','project-with-artifacts.json'],['v0.2','project-with-receipts.json']]) {
  test(`real ${version} fixture migrates deterministically and remains readable`,async()=>{
    const legacy=await fixture(version,name);
    const first=migrateProject(legacy);
    const second=migrateProject(legacy);
    assert.equal(first.schemaVersion,5);
    assert.equal(canonicalSha256(first),canonicalSha256(second));
    validateRuntimeSchema('project',first);
    validateProjectAggregate(first);
    assert.ok(first.audit?.events?.length>=1);
    assert.ok(first.migrations?.length>=1);
    for(const evidence of first.evidence)assert.equal(evidence.status,'unverified');
    for(const artifact of first.artifacts){
      assert.equal(artifact.slot,'default');
      assert.match(artifact.contentHash,/^[a-f0-9]{64}$/);
      assert.match(artifact.envelopeHash,/^[a-f0-9]{64}$/);
      assert.ok(artifact.producedBy.trustDomain);
    }
    const again=migrateProject(first);
    assert.equal(canonicalSha256(again),canonicalSha256(first));
  });
}

test('migration plan is a dry-run report and does not mutate source',async()=>{
  const legacy=await fixture('v0.1','project-with-artifacts.json');
  const before=canonicalSha256(legacy);
  const report=planMigration(legacy);
  assert.equal(report.from,2);
  assert.equal(report.to,5);
  assert.deepEqual(report.steps,["2->3","3->4","4->5"]);
  assert.equal(report.projectId,legacy.id);
  assert.equal(report.legacyArtifacts,1);
  assert.equal(report.legacyEvidence,1);
  assert.match(report.sourceSha256,/^[a-f0-9]{64}$/);
  assert.match(report.resultSha256,/^[a-f0-9]{64}$/);
  assert.equal(canonicalSha256(legacy),before);
});
