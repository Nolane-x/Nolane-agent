import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const version='5.0.0-beta.1';
test('Beta.1 release documents describe GitHub NSIS updates and preserve non-claims',async()=>{
  const [readme,release,limits,verification,releasing]=await Promise.all([
    readFile('README.md','utf8'),readFile(`docs/RELEASE-${version}.md`,'utf8'),readFile(`docs/LIMITATIONS-${version}.md`,'utf8'),readFile(`docs/VERIFICATION-REPORT-${version}.md`,'utf8'),readFile('docs/RELEASING.md','utf8')]);
  const currentVersion=JSON.parse(await readFile('package.json','utf8')).version;
  for(const text of [release,limits,verification]) assert.match(text,/5\.0\.0-beta\.1/);
  assert.match(readme,new RegExp(currentVersion.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.doesNotMatch(readme,/5\.0\.0-beta\.1 —/);
  assert.match(readme,/GitHub Actions|GitHub tag release/);
  assert.match(release,/NSIS installer|signed Nolane update manifest/i);
  assert.match(limits,/cannot itself produce.*Windows.*\.exe|actual installer.*external/i);
  assert.match(verification,/actual installer publication.*external/i);
  assert.match(releasing,/NOLANE_UPDATE_PRIVATE_KEY_B64/);

  assert.match(release,/193(?:\/198| verified)|5 explicitly open/i);
  assert.match(limits,/There are 5 open requirements/i);
  assert.match(verification,/193 verified requirements and 5 open requirements/i);
  assert.doesNotMatch(limits,/legacy external reference archive after|The legacy external reference remains evidence-only/i);
  assert.match(limits,/NolaneNative executable and packaged surfaces are retired/i);
  assert.doesNotMatch(readme,/NolaneNative 2\.29\.0 bundled directly|NolaneNative reference pack/i);
});
