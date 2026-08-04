import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('CI runs v0.6 generation, audit, benchmarks, adversarial suites, protocol smoke, TCK, coverage, and clean-tree check',async()=>{
  const body=await readFile('.github/workflows/ci.yml','utf8');
  for(const command of ['npm run generate:v06','npm run v06:audit','npm run skills:certification-audit','npm run test:mutation-critical','npm run router:benchmark','npm run context:benchmark','npm run federation:eval','npm run federation:audit','npm run validate','npm run smoke','npm run adapter:tck','npm run test:coverage','git diff --exit-code'])assert.match(body,new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.match(body,/FORGEOS_ADAPTER_TCK_OUTPUT=dist\/ci\/adapter-tck\.json npm run adapter:tck/);
  assert.doesNotMatch(body,/npm run generate:v2\s*$/m);
});
