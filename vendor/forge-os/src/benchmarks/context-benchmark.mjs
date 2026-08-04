import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { canonicalSha256 } from '../core/canonical-json.mjs';
import { SkillIntelligenceService } from '../intelligence/service.mjs';
import { BlobStore } from '../storage/blob-store.mjs';
import { createDefaultTokenAccountingRegistry } from '../context/token-accounting.mjs';
import { distillToolOutput } from '../context/tool-output-distiller.mjs';
import { buildSemanticAbi } from '../context/semantic-abi.mjs';
import { compileGlobalContext } from '../context/context-compiler.mjs';

function syntheticLog(lines = 12000) {
  const out = [];
  for (let index = 1; index <= lines; index++) {
    if (index === 2800) out.push(`ERROR test/payment.test.mjs:${index}: expected 200 actual 500`);
    else if (index === 2801) out.push('    at processPayment (src/payment.mjs:84:13)');
    else if (index === 9100) out.push(`FAIL integration/session.test.mjs:${index}: timeout waiting for session cleanup`);
    else out.push(`trace ${String(index).padStart(5, '0')} deterministic diagnostic line with repeated low-value context`);
  }
  return out.join('\n');
}

function syntheticSource(functions = 40, bodyLines = 80) {
  const blocks = [];
  for (let index = 0; index < functions; index++) {
    const body = [];
    for (let line = 0; line < bodyLines; line++) body.push(`  const value${line} = input + ${line};`);
    body.push(`  return value${bodyLines - 1};`);
    blocks.push(`export function operation${index}(input) {\n${body.join('\n')}\n}`);
  }
  return blocks.join('\n\n');
}

export async function runContextBenchmark({ root = process.cwd(), model = 'gpt-5.6' } = {}) {
  const registry = createDefaultTokenAccountingRegistry();
  const service = new SkillIntelligenceService({ root, tokenRegistry: registry });
  const stableMaterialization = await service.auditStableMaterialization({ model });
  const temp = await mkdtemp(path.join(os.tmpdir(), 'forgeos-context-benchmark-'));
  try {
    const blobStore = new BlobStore(path.join(temp, 'blobs'));
    const log = syntheticLog();
    const distilled = await distillToolOutput({
      command: 'npm test',
      exitCode: 1,
      durationMs: 1987,
      stdout: log,
      blobStore,
      tokenRegistry: registry,
      model,
    });

    const codeRoot = path.join(temp, 'repo');
    await mkdir(codeRoot, { recursive: true });
    const source = syntheticSource();
    await writeFile(path.join(codeRoot, 'operations.mjs'), source, 'utf8');
    const abi = await buildSemanticAbi({ root: codeRoot });
    const orientation = JSON.stringify({
      schemaVersion: abi.schemaVersion,
      symbols: abi.symbols.map(({ body, ...symbol }) => symbol),
      abiSha256: abi.abiSha256,
    });
    const rawCodeTokens = await registry.countText(model, source);
    const orientationTokens = await registry.countText(model, orientation);

    const inputs = {
      system: [{ id: 'system-policy', text: 'Use ForgeOS policy profiles and preserve evidence provenance.', required: true }],
      task: [{ id: 'task', text: 'Implement the requested behavior and report only verified outcomes.', required: true }],
      skills: [{ id: 'skill-core', text: 'Follow the selected procedure, verification, and stop conditions.', priority: 100 }],
      code: Array.from({ length: 8 }, (_, index) => ({ id: `code-${index + 1}`, text: `symbol map ${index} `.repeat(80), priority: 100 - index })),
      artifacts: Array.from({ length: 7 }, (_, index) => ({ id: `artifact-${index + 1}`, text: `artifact projection ${index} `.repeat(45), priority: 70 - index })),
      memory: [{ id: 'memory-current', text: 'Current project decision summary with provenance.', priority: 80 }],
      toolOutput: [{ id: 'tool-summary', text: distilled.summary, priority: 90, retrieval: distilled.raw.uri }],
      references: Array.from({ length: 5 }, (_, index) => ({ id: `reference-${index + 1}`, text: `reference metadata ${index} `.repeat(40), priority: 30 - index, retrieval: `forge://reference/${index + 1}` })),
    };
    const policy = {
      modelContextLimit: 8192,
      hardInputLimit: 5600,
      outputReserve: 1200,
      safetyReserve: 600,
      budgets: { system: 300, task: 300, skills: 350, code: 1000, artifacts: 550, memory: 250, toolOutput: 650, references: 300 },
    };
    let overflowCount = 0;
    let compiled;
    try { compiled = await compileGlobalContext({ model, policy, tokenRegistry: registry, inputs }); }
    catch (error) { overflowCount++; throw error; }
    const omittedInputIds = new Set(compiled.omissions.map((entry) => entry.sourceId));
    const includedInputIds = new Set(Object.values(compiled.context).flat().map((entry) => entry.id));
    const allInputIds = Object.values(inputs).flat().map((entry) => entry.id);
    const unmanifestedOmissions = allInputIds.filter((id) => !includedInputIds.has(id) && !omittedInputIds.has(id)).length;

    const payload = {
      schemaVersion: 1,
      benchmarkId: 'forgeos-context-public-v1',
      stableMaterialization,
      globalBudget: {
        overflowCount,
        unmanifestedOmissions,
        totalInputTokens: compiled.accounting.totalInputTokens,
        availableInput: compiled.budget.availableInput,
        omissionCount: compiled.omissions.length,
        omissionManifestSha256: compiled.omissionManifest.sha256,
      },
      toolDistillation: {
        rawTokens: distilled.accounting.rawTokens,
        distilledTokens: distilled.accounting.distilledTokens,
        reductionRatio: distilled.accounting.reductionRatio,
        receiptSha256: distilled.receiptSha256,
      },
      semanticAbi: {
        symbolCount: abi.symbols.length,
        rawCodeTokens,
        orientationTokens,
        orientationReductionRatio: rawCodeTokens ? 1 - orientationTokens / rawCodeTokens : 0,
        abiSha256: abi.abiSha256,
      },
    };
    return Object.freeze({ ...payload, reportSha256: canonicalSha256(payload) });
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}
