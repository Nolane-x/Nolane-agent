import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('app composes one repository intelligence fabric without increasing composition budgets', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /import \{ createRepositoryIntelligenceFabric \} from '\.\/repository\/repository-intelligence-fabric\.mjs';/);
  assert.equal((source.match(/createRepositoryIntelligenceFabric\(/g) ?? []).length, 1);
  assert.doesNotMatch(source, /import \{ RepositoryIndex \} from '\.\/repository\/repository-index\.mjs';/);
  assert.doesNotMatch(source, /import \{ SecureSemanticIndex \} from '\.\/repository\/secure-semantic-index\.mjs';/);
  assert.match(source, /repositoryIntelligenceFabric\.digitalTwin/);
  assert.match(source, /repositoryIntelligence: await repositoryIntelligenceFabric\.status\(\)/);
  assert.match(source, /await repositoryIntelligenceFabric\.close\(\)/);
  const imports = (source.match(/^import\s/mg) ?? []).length;
  const constructors = (source.match(/\bnew\s+[A-Z][A-Za-z0-9_$]*\s*\(/g) ?? []).length;
  assert.ok(imports <= 160, `app.mjs imports ${imports} exceed budget 160`);
  assert.ok(constructors <= 180, `app.mjs constructors ${constructors} exceed budget 180`);
});
