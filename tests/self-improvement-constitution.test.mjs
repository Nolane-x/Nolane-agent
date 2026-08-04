import test from 'node:test';
import assert from 'node:assert/strict';
import { SelfImprovementConstitution } from '../src/frontier/self-improvement-constitution.mjs';

const H=(c)=>c.repeat(64);
const valid = { candidateId:'policy-1', artifactType:'policy', version:'3.0.1-candidate.1', provenanceReceiptSha256:H('1'), rollbackRef:'policy@3.0.0', irreversibility:0.7, evidenceScore:0.93, viability:{withinRegion:true,receiptSha256:H('2')}, requestedAutonomy:'unchanged', changes:[{kind:'routing-weight',scope:'shadow'}] };

test('constitution rejects forbidden self updates and scales evidence threshold with irreversibility', () => {
  const constitution = new SelfImprovementConstitution();
  const forbidden = constitution.evaluateCandidate({ ...valid, candidateId:'bad', changes:[{kind:'disable-verifier',scope:'release'}] });
  assert.equal(forbidden.allowed,false);
  assert.ok(forbidden.blockers.includes('forbidden:disable-verifier'));
  const insufficient = constitution.evaluateCandidate({ ...valid, candidateId:'weak', irreversibility:0.9, evidenceScore:0.8 });
  assert.equal(insufficient.allowed,false);
  assert.ok(insufficient.blockers.includes('evidence-threshold-not-met'));
  const viable = constitution.evaluateCandidate(valid);
  assert.equal(viable.allowed,true);
  assert.ok(viable.requiredEvidenceThreshold > 0.8);
});

test('constitution enforces candidate to canary sequence and human gate without executing promotion', () => {
  const constitution = new SelfImprovementConstitution();
  constitution.evaluateCandidate(valid);
  for (const stage of ['candidate','sandbox','held-out','regression','red-team','shadow','canary']) constitution.recordStage('policy-1',{ stage, status:'pass', receiptSha256:H(String((stage.length%9)+1)) });
  assert.throws(()=>constitution.authorizePromotion('policy-1',{ approved:false, actor:'human:owner', receiptSha256:H('a') }),/human approval/);
  const result=constitution.authorizePromotion('policy-1',{ approved:true, actor:'human:owner', receiptSha256:H('a') });
  assert.equal(result.status,'ready-for-human-controlled-promotion');
  assert.equal(result.claims.productionPromotionExecuted,false);
  assert.equal(result.claims.autonomyExpanded,false);
});
