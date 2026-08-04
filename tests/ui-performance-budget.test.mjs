import test from 'node:test'; import assert from 'node:assert/strict';
import { validateUiPerformanceBaseline } from '../ui-v3/core/performance-observer.mjs';
test('performance baseline rejects missing machine metadata and fake zero measurements',()=>{ assert.throws(()=>validateUiPerformanceBaseline({}),/machine/i); assert.throws(()=>validateUiPerformanceBaseline({machine:{os:'win32',ramGb:8},metrics:{readyToShowMs:0}}),/positive/i); });
test('pending external baseline remains explicit and never certifies Windows',()=>{ const r=validateUiPerformanceBaseline({machine:{os:'pending',ramGb:8},status:'pending-external',metrics:null}); assert.equal(r.windows8GbCertified,false); });
