import test from 'node:test'; import assert from 'node:assert/strict';
import { createApprovalCard } from '../ui-v3/views/mission/approval-card.mjs';
import { createPermissionCard } from '../ui-v3/views/mission/permission-card.mjs';
import { createRecoveryCard } from '../ui-v3/views/mission/recovery-card.mjs';
import { formatRiskMoment } from '../ui-v3/core/risk-copy.mjs';
test('risk formatter makes destructive scope and reversibility explicit',()=>{ const r=formatRiskMoment({kind:'destructive',action:'Delete cache',reason:'repair',impact:'removes cache',scope:['cache'],reversible:false}); assert.equal(r.severity,'danger'); assert.equal(r.reversibility,'Not reversible'); });
test('permission card rejects missing scope or expiry and records bounded decision',()=>{ assert.throws(()=>createPermissionCard({id:'p',action:'read',scope:[],expiresAt:'x'}),/scope/i); assert.throws(()=>createPermissionCard({id:'p',action:'read',scope:['repo']}),/expiry/i); const c=createPermissionCard({id:'p',action:'read',scope:['repo'],expiresAt:'2030-01-01T00:00:00Z'}); assert.equal(c.decide('allow-once').decision,'allow-once'); });
test('approval and recovery cards fail closed for unsafe actions',()=>{ const a=createApprovalCard({id:'a',action:'migrate',impact:'schema',scope:['db'],reversible:true}); assert.throws(()=>a.decide('unknown'),/decision/i); const r=createRecoveryCard({id:'r',strategy:'reset',destructive:true,approved:false}); assert.throws(()=>r.execute(),/approval/i); });
