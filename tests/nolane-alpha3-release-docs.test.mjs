import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const canonical = [
  'docs/reference/Nolane-Agent-UI-UX-Master-Plan.md',
  'docs/reference/Nolane-Agent-Independent-Audit.md',
  'docs/reference/Nolane-Agent-Small-Model-Research.md',
];

test('alpha.3 canonical documents use Nolane Agent identity and contain proof-driven non-claims', async () => {
  for (const file of canonical) {
    const text = await readFile(file,'utf8');
    assert.match(text,/Nolane Agent/);
    assert.match(text,/Alpha\.3 proof-driven update/);
    assert.match(text,/chưa có model Nolane đã huấn luyện|No trained model|chưa có model/i);
  }
  const limitations = await readFile('docs/LIMITATIONS-5.0.0-alpha.3.md','utf8');
  assert.match(limitations,/The legacy external reference remains third-party MIT research material/);
  assert.match(limitations,/No Nolane foundation model has been trained/);
});
