import { readFile, writeFile } from 'node:fs/promises';

const target = 'docs/superpowers/specs/2026-08-29-ephemeral-capability-composition-v1-design.md';
let source = await readFile(target, 'utf8');
const marker = '## 19. Expected code surface\n';
const index = source.indexOf(marker);
if (index < 0) throw new Error('missing spec section 19 marker');
if (source.indexOf(marker, index + 1) >= 0) throw new Error('ambiguous spec section 19 marker');

const closure = [
  '## 18.1 Runtime input contract invariant',
  '',
  'The registered model-facing parameter schema is not documentation-only. Every `ephemeral.*` invocation must validate the model-supplied input against the frozen registered schema **before the first primitive effect is attempted**.',
  '',
  'For the V1 bounded schema subset, runtime validation enforces the declared type recursively plus `required`, `additionalProperties:false`, `enum`, `const`, numeric minimum/maximum/exclusive bounds, string length bounds, array length bounds, nested object schemas, and array item schemas. Dangerous property names `__proto__`, `prototype`, and `constructor` are rejected at schema-definition and runtime-validation boundaries.',
  '',
  'Invalid input fails closed with a typed error and **zero child primitive executions**. Step `args` must themselves be plain objects; arrays or other non-object values are invalid definitions.',
  '',
  '## 18.2 Tool-call budget non-laundering invariant',
  '',
  'Ephemeral composition may compress **model-facing orchestration**, but it must never compress runtime governance accounting.',
  '',
  '- `tool.compose.create` consumes the normal top-level model tool-call budget unit.',
  '- Each top-level `ephemeral.*` invocation consumes the normal top-level model tool-call budget unit.',
  '- Every primitive child consumes one additional tool-call budget unit immediately before entering its governed child execution path.',
  '- Budget exhaustion during a composite fails closed; no later child may execute.',
  '- A denied child attempt may still consume the child budget unit because the governed attempt has begun.',
  '',
  'Therefore a model cannot turn one apparent tool call into multiple unaccounted effects. The expected trade-off is fewer model turns/top-level calls in exchange for unchanged primitive work and deliberately explicit governance/provenance accounting.',
  '',
  '## 18.3 V1 mechanism benchmark evidence',
  '',
  'A deterministic mechanism benchmark was added using the real `AgentLoop`, `ToolBroker`, `StudioStore`, context builder, and provider registry with only the model replaced by a deterministic fake provider to remove external-model variance. Both arms execute four identical dependent `fs.search -> fs.read` procedures and therefore eight primitive filesystem effects.',
  '',
  'Observed result for four repetitions:',
  '',
  '| Metric | Baseline model orchestration | Ephemeral composite | Delta |',
  '| --- | ---: | ---: | ---: |',
  '| model requests / turns | 9 | 6 | -33.33% |',
  '| top-level model tool calls | 8 | 5 | -37.50% |',
  '| primitive effects | 8 | 8 | 0% |',
  '| governed tool-call budget units | 8 | 13 | +5 |',
  '| first-class receipts | 8 | 13 | +5 |',
  '',
  'This is intentionally classified as `mechanism-only-no-intelligence-comparison`. It demonstrates reusable orchestration compression while proving that primitive effects, budget accounting, and receipts are not hidden. It does **not** establish higher solve rate, general intelligence, or superiority over another harness. Those claims require later same-model task evaluations.',
  '',
  '## 18.4 Additional closure tests',
  '',
  'The implemented V1 closure adds explicit tests for:',
  '',
  '25. runtime rejection of missing required input before any primitive effect;',
  '26. runtime rejection of undeclared additional properties;',
  '27. runtime rejection of wrong scalar/container types, enum/const violations, and numeric/string/array bounds;',
  '28. nested object validation and dangerous parameter property names;',
  '29. non-object step argument rejection;',
  '30. child tool-call budget accounting and budget-laundering prevention;',
  '31. deterministic baseline-versus-composite mechanism benchmark with equal primitive effects.',
  '',
].join('\n');

source = source.slice(0, index) + closure + source.slice(index);
await writeFile(target, source);
console.log(JSON.stringify({ status: 'patched', target, bytes: Buffer.byteLength(source) }));
