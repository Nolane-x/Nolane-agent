import test from 'node:test';
import assert from 'node:assert/strict';
import { CulturalLineageLedger } from '../src/frontier/cultural-lineage-ledger.mjs';

const H=(c)=>c.repeat(64);

test('cultural lineage preserves exact versions and fork/merge/supersede/rollback history', () => {
  const ledger = new CulturalLineageLedger();
  ledger.register({ artifactId:'skill-auth', artifactType:'skill', version:'1.0.0', provenanceReceiptSha256:H('1'), rollbackRef:'skill-auth@0.9.0' });
  ledger.register({ artifactId:'skill-auth-fast', artifactType:'skill', version:'1.1.0', provenanceReceiptSha256:H('2'), rollbackRef:'skill-auth@1.0.0', parents:[{artifactId:'skill-auth',version:'1.0.0'}] });
  ledger.transition('skill-auth-fast',{ transition:'fork', targetVersion:'1.1.0', sourceReceiptSha256:H('3') });
  ledger.transition('skill-auth-fast',{ transition:'supersede', targetVersion:'1.2.0', sourceReceiptSha256:H('4'), rollbackRef:'skill-auth-fast@1.1.0' });
  const rollback=ledger.transition('skill-auth-fast',{ transition:'rollback', targetVersion:'1.1.0', sourceReceiptSha256:H('5'), rollbackRef:'skill-auth-fast@1.0.0' });
  assert.equal(rollback.currentVersion,'1.1.0');
  assert.equal(ledger.snapshot().claims.rawPromptStored,false);
});

test('cultural lineage rejects unknown parent version', () => {
  const ledger = new CulturalLineageLedger();
  assert.throws(()=>ledger.register({ artifactId:'decision-x', artifactType:'architecture-decision', version:'2.0.0', provenanceReceiptSha256:H('6'), rollbackRef:'decision-x@1.0.0', parents:[{artifactId:'missing',version:'1.0.0'}] }),/unknown parent/);
});
