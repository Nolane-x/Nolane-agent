import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { generateKeyPairSync, verify } from 'node:crypto';
import { generateSbom } from '../scripts/generate-sbom.mjs';
import { createReleaseProvenance, signReleaseProvenance } from '../scripts/sign-release.mjs';
import { canonicalStringify } from '../src/core/canonical-json.mjs';

test('SBOM is derived from package-lock rather than a hardcoded component count', async()=>{
  const sbom=await generateSbom(process.cwd());
  assert.equal(sbom.bomFormat,'CycloneDX');
  assert.equal(sbom.specVersion,'1.6');
  assert.ok(sbom.components.some((component)=>component.name==='forge-os'));
  assert.equal(sbom.metadata.component.version,(JSON.parse(await readFile('package.json','utf8'))).version);
});

test('release provenance binds artifact bytes and verifies with a detached Ed25519 signature', async(t)=>{
  const root=await mkdtemp(path.join(tmpdir(),'forge-provenance-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const artifact=path.join(root,'forge.zip');await writeFile(artifact,'immutable release bytes');
  const statement=await createReleaseProvenance({root:process.cwd(),artifacts:[artifact],builderId:'forgeos:test'});
  const {privateKey,publicKey}=generateKeyPairSync('ed25519');
  const signed=signReleaseProvenance(statement,privateKey);
  assert.equal(signed.signature.algorithm,'Ed25519');
  assert.equal(verify(null,Buffer.from(canonicalStringify(statement)),publicKey,Buffer.from(signed.signature.value,'base64')),true);
  assert.match(statement.subject[0].digest.sha256,/^[a-f0-9]{64}$/);
  assert.ok(statement.predicate.runDetails.byproducts[0].fileCount > 0);
  assert.equal(statement.predicate.buildDefinition.internalParameters.sourceManifestAlgorithm,'sha256-canonical-text-v1');
});
