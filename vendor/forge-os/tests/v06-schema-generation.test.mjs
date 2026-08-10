import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const expected=[
  'v06-status.schema.json',
  'execution-graph.schema.json',
  'review-scope.schema.json',
  'work-unit-context.schema.json',
  'harness-profile-plan.schema.json',
  'agent-surface-scan.schema.json',
];

test('schema generator publishes all strict v0.6 public contracts',async()=>{
  for(const file of expected){
    await access(`schemas/${file}`);
    const schema=JSON.parse(await readFile(`schemas/${file}`,'utf8'));
    assert.equal(schema.additionalProperties,false,`${file} must reject unknown top-level fields`);
    assert.match(schema.$id,/\/v0\.6\//);
  }
});
