import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

test('v0.6 package exposes the Deterministic Skill Fabric, review packs, v2 catalogs, benchmarks, and production assets', async()=>{
  const pkg=JSON.parse(await readFile('package.json','utf8'));
  assert.equal(pkg.version,'0.6.1');
  assert.equal(pkg.engines.node,'>=22');
  assert.equal(pkg.bin.forge,'src/cli/forge.mjs');
  for(const entry of ['capabilities','capabilities-v2','skills-v2','benchmarks','knowledge','providers','config','deploy','packs','examples','Dockerfile','.env.example'])assert.ok(pkg.files.includes(entry),entry);
  for(const script of ['generate:v2','generate:v06','skills:v2:audit','skills:materialize-all-stable','router:benchmark','context:benchmark','v06:audit','skills:certification-audit','test:mutation-critical'])assert.ok(pkg.scripts[script],script);
  await access('assets/forgeos-mark.svg');
  await access('src/cli/forge.mjs');
  await access('packs/code-review-intelligence/manifest.json');
  await access('packs/code-review-intelligence/benchmark/cases.json');
  const readme=await readFile('README.md','utf8');
  assert.match(readme,/assets\/forgeos-mark\.svg/);
});
