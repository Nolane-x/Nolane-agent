import { readFile, writeFile } from 'node:fs/promises';

const path = 'tests/ephemeral-capability-registry.test.mjs';
let source = await readFile(path, 'utf8');
const before = "  await registry.invoke(literal.name, {}, { isPrimitiveActive: () => true, async executePrimitive({ args }) { observed = args; return { status: 'pass', output: 'ok', receipt: { receiptSha256: hash('c') } }; } });";
const after = "  await registry.invoke(literal.name, { symbol: 'unused' }, { isPrimitiveActive: () => true, async executePrimitive({ args }) { observed = args; return { status: 'pass', output: 'ok', receipt: { receiptSha256: hash('c') } }; } });";
const index = source.indexOf(before);
if (index < 0) throw new Error('missing literal fixture marker');
if (source.indexOf(before, index + 1) >= 0) throw new Error('ambiguous literal fixture marker');
source = source.slice(0, index) + after + source.slice(index + before.length);
await writeFile(path, source);
console.log(JSON.stringify({ status: 'patched-test-fixture' }));
