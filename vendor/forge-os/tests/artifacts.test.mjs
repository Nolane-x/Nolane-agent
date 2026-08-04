import test from 'node:test';
import assert from 'node:assert/strict';
import { createArtifact, reviewArtifact, verifyArtifact, supersedeArtifact } from '../src/core/artifacts.mjs';
import { createPrincipal } from '../src/core/principals.mjs';

const worker=createPrincipal({id:'worker-1',type:'agent',roles:['worker'],scopes:['*'],trustDomain:'team:build'});
const reviewer=createPrincipal({id:'reviewer-1',type:'agent',roles:['reviewer'],scopes:['*'],trustDomain:'team:review'});
const base={projectId:'forge_abc123',type:'product-thesis',schemaVersion:'1.0.0',title:'Product thesis',content:{thesis:'Build a verified agent product OS'},producedBy:{skill:'defining-product-thesis'},consumes:['artifact_intent'],decisions:['decision_scope'],evidence:[],residualRisks:[]};

test('artifacts are content-addressed and authenticated-provenance preserving',()=>{const first=createArtifact(base,{id:'artifact_thesis',now:'2026-07-24T00:00:00.000Z',principal:worker});const second=createArtifact(base,{id:'artifact_thesis_2',now:'2026-07-24T00:00:00.000Z',principal:worker});assert.equal(first.sha256,second.sha256);assert.equal(first.state,'draft');assert.equal(first.producedBy.principalId,'worker-1');});

test('review, verification, and supersession preserve immutable lineage',()=>{const draft=createArtifact(base,{id:'artifact_thesis',now:'2026-07-24T00:00:00.000Z',principal:worker});const reviewed=reviewArtifact(draft,{principal:reviewer,notes:'Contract and evidence checked.',now:'2026-07-24T00:30:00.000Z'});const verified=verifyArtifact(reviewed,{gateId:'gate_thesis',principal:reviewer,evidence:['evidence_review'],now:'2026-07-24T01:00:00.000Z'});assert.equal(verified.state,'verified');assert.equal(verified.verification.reviewer.id,'reviewer-1');const old=supersedeArtifact(verified,'artifact_thesis_v2','2026-07-24T02:00:00.000Z');assert.equal(old.state,'superseded');assert.equal(draft.state,'draft');});
