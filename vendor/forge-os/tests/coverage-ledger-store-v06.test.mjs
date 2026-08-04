import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {SqliteCoverageLedgerStore} from '../src/fabric/coverage-ledger-store.mjs';

const units=[{unitId:'WU-a',files:['a.mjs']},{unitId:'WU-b',files:['b.mjs']}];
const wait=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));

test('coverage ledger persists work units and completes only with current lease fencing token',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'forge-coverage-'));
  const file=path.join(dir,'coverage.sqlite');
  const store=new SqliteCoverageLedgerStore(file);
  try{
    const ledger=await store.create({ledgerId:'ledger-001',graphSha256:'a'.repeat(64),workUnits:units});
    assert.equal(ledger.coverage.total,2);
    const lease=await store.acquire('ledger-001','WU-a',{workerId:'worker-a',ttlMs:10_000});
    assert.equal(lease.fencingSequence,1);
    await assert.rejects(()=>store.complete('ledger-001','WU-a',{workerId:'worker-b',leaseToken:lease.leaseToken,fencingSequence:1,receiptSha256:'b'.repeat(64)}),/owner/i);
    const completed=await store.complete('ledger-001','WU-a',{workerId:'worker-a',leaseToken:lease.leaseToken,fencingSequence:1,receiptSha256:'b'.repeat(64)});
    assert.equal(completed.status,'completed');
    const snapshot=await store.snapshot('ledger-001');
    assert.equal(snapshot.coverage.completed,1);
    assert.equal(snapshot.records.find(item=>item.unitId==='WU-a').receiptSha256,'b'.repeat(64));
  }finally{store.close();await rm(dir,{recursive:true,force:true});}
});

test('expired lease is reclaimed and stale worker cannot complete after fencing advances',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'forge-coverage-'));
  const store=new SqliteCoverageLedgerStore(path.join(dir,'coverage.sqlite'));
  try{
    await store.create({ledgerId:'ledger-002',graphSha256:'c'.repeat(64),workUnits:units});
    const first=await store.acquire('ledger-002','WU-a',{workerId:'worker-old',ttlMs:20});
    await wait(35);
    const second=await store.acquire('ledger-002','WU-a',{workerId:'worker-new',ttlMs:10_000});
    assert.equal(second.fencingSequence,first.fencingSequence+1);
    await assert.rejects(()=>store.complete('ledger-002','WU-a',{workerId:'worker-old',leaseToken:first.leaseToken,fencingSequence:first.fencingSequence,receiptSha256:'d'.repeat(64)}),/stale|fencing|lease/i);
    await store.complete('ledger-002','WU-a',{workerId:'worker-new',leaseToken:second.leaseToken,fencingSequence:second.fencingSequence,receiptSha256:'e'.repeat(64)});
  }finally{store.close();await rm(dir,{recursive:true,force:true});}
});

test('ledger completion is fail closed until every unit has a trusted receipt',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'forge-coverage-'));
  const store=new SqliteCoverageLedgerStore(path.join(dir,'coverage.sqlite'));
  try{
    await store.create({ledgerId:'ledger-003',graphSha256:'f'.repeat(64),workUnits:units});
    const a=await store.acquire('ledger-003','WU-a',{workerId:'worker-1',ttlMs:10_000});
    await store.complete('ledger-003','WU-a',{workerId:'worker-1',leaseToken:a.leaseToken,fencingSequence:a.fencingSequence,receiptSha256:'1'.repeat(64)});
    await assert.rejects(()=>store.assertComplete('ledger-003'),/incomplete/i);
    const b=await store.acquire('ledger-003','WU-b',{workerId:'worker-2',ttlMs:10_000});
    await store.complete('ledger-003','WU-b',{workerId:'worker-2',leaseToken:b.leaseToken,fencingSequence:b.fencingSequence,receiptSha256:'2'.repeat(64)});
    const done=await store.assertComplete('ledger-003');
    assert.equal(done.status,'complete');
    assert.match(done.coverageSha256,/^[a-f0-9]{64}$/);
  }finally{store.close();await rm(dir,{recursive:true,force:true});}
});
