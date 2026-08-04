import test from 'node:test';
import assert from 'node:assert/strict';
import { ChangeSurvivalLedger } from '../src/frontier/change-survival-ledger.mjs';

const H=(c)=>c.repeat(64);

test('change survival matures only after configured observation window and emits shadow credit', () => {
  let now = 0;
  const ledger = new ChangeSurvivalLedger({ clock:()=>now });
  ledger.registerChange({ changeId:'chg-1', mergedAtMs:0, observationWindowDays:7, commitReceiptSha256:H('1'), patchReceiptSha256:H('2'), routerChoiceId:'route-a', skillId:'skill-a' });
  now = 2*24*60*60*1000;
  ledger.observe('chg-1',{ kind:'bug', severity:'high', sourceReceiptSha256:H('3'), observedAtMs:now });
  assert.equal(ledger.evaluate('chg-1').status,'observing');
  now = 8*24*60*60*1000;
  const matured = ledger.evaluate('chg-1');
  assert.equal(matured.status,'matured');
  assert.ok(matured.survivalScore < 1);
  const credit = ledger.shadowCredit('chg-1');
  assert.equal(credit.shadowOnly,true);
  assert.equal(credit.productionRoutingChanged,false);
  assert.equal(credit.routerChoiceId,'route-a');
});

test('survival ledger records revert, rewrite and technical debt separately', () => {
  let now = 0; const ledger = new ChangeSurvivalLedger({ clock:()=>now });
  ledger.registerChange({ changeId:'chg-2', mergedAtMs:0, observationWindowDays:30, commitReceiptSha256:H('4'), patchReceiptSha256:H('5') });
  for (const [kind,day] of [['revert',1],['rewrite',2],['technical-debt',3]]) { now=day*86400000; ledger.observe('chg-2',{kind,severity:'medium',sourceReceiptSha256:H(String(day+5)),observedAtMs:now}); }
  const snap=ledger.snapshot('chg-2');
  assert.deepEqual(snap.observations.map(x=>x.kind),['revert','rewrite','technical-debt']);
});
