import test from 'node:test';
import assert from 'node:assert/strict';
import { createAssertionBinding, evaluateAssertionBinding, buildBindingCoverage } from '../src/forensics/assertion-evidence-binding.mjs';

const h = (c) => c.repeat(64);
function binding(overrides={}) { return { requirementId:'NOL-UI-X', productionEntrypoints:['src/app.mjs'], productionEntrypointSha256:[h('a')], testFile:'tests/x.test.mjs', testFileSha256:h('b'), namedTests:['works','rejects stale'], positiveAssertions:['works'], negativeAssertions:['rejects stale'], receiptSha256:h('c'), ...overrides }; }

test('binding rejects documentation as a production entrypoint',()=>assert.throws(()=>createAssertionBinding(binding({productionEntrypoints:['docs/a.md']})),/documentation/i));
test('binding requires named tests and positive and negative assertions',()=>{ assert.throws(()=>createAssertionBinding(binding({positiveAssertions:[]})),/positive assertions/i); assert.throws(()=>createAssertionBinding(binding({negativeAssertions:[]})),/negative assertions/i); });
test('verified evaluation requires files and hashes to match',()=>{ const b=binding(); const ok=evaluateAssertionBinding(b,{existingPaths:new Set(['src/app.mjs','tests/x.test.mjs']),sha256ByPath:new Map([['src/app.mjs',h('a')],['tests/x.test.mjs',h('b')]])}); assert.equal(ok.status,'verified'); const stale=evaluateAssertionBinding(b,{existingPaths:new Set(['src/app.mjs','tests/x.test.mjs']),sha256ByPath:new Map([['src/app.mjs',h('d')],['tests/x.test.mjs',h('b')]])}); assert.equal(stale.status,'invalid'); });
test('coverage reports unbound requirements and excessive test reuse without upgrading them',()=>{ const bs=Array.from({length:3},(_,i)=>binding({requirementId:`R${i}`})); const r=buildBindingCoverage({requirements:[{id:'R0'},{id:'R1'},{id:'R2'},{id:'R3'}],bindings:bs,maxRequirementsPerTest:2}); assert.equal(r.summary.requirementsUnbound,1); assert.equal(r.summary.overBroadTestFiles,1); assert.equal(r.certifiable,false); });
