import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runFederationAdversarialCorpus, validateFederationAdversarialCorpus } from '../src/evals/federation-adversarial.mjs';

const FILE=new URL('../evals/federation/adversarial-corpus.json',import.meta.url);

test('federation adversarial corpus covers security, trust, quality, licensing, MCP, and deduplication',async()=>{
  const cases=JSON.parse(await readFile(FILE,'utf8'));
  const report=validateFederationAdversarialCorpus(cases);
  assert.equal(cases.length,18);
  assert.deepEqual(report.errors,[]);
  for(const category of ['skill-scan','license','mcp-assess','provider-eval','dedup'])assert.ok(report.categories.includes(category),category);
});

test('all federation adversarial cases pass against the current trust boundary',async()=>{
  const cases=JSON.parse(await readFile(FILE,'utf8'));
  const result=runFederationAdversarialCorpus(cases);
  assert.equal(result.summary.total,18);
  assert.equal(result.summary.failed,0,JSON.stringify(result.failures,null,2));
  assert.equal(result.summary.passed,18);
  assert.match(result.corpusSha256,/^[a-f0-9]{64}$/);
});
