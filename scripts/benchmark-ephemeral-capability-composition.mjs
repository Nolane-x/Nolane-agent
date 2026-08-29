#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { AgentLoop } from '../src/agent/agent-loop.mjs';
import { ContextBuilder } from '../src/agent/context-builder.mjs';
import { ProviderRegistry } from '../src/providers/provider-registry.mjs';
import { StudioStore } from '../src/storage/studio-store.mjs';
import { ToolBroker } from '../src/execution/tool-broker.mjs';

function contextPack(task) {
  return {
    routePlan: { routePlanSha256: 'a'.repeat(64), steps: [] },
    skills: [],
    compiled: {
      context: { system: [{ text: 'Benchmark authority' }], task: [{ text: task }], skills: [], code: [], artifacts: [], memory: [], toolOutput: [], references: [] },
      omissions: [],
      contextReceiptSha256: 'b'.repeat(64),
    },
    contextPackSha256: 'c'.repeat(64),
  };
}

function compositeDefinition() {
  return {
    name: 'searchThenRead',
    description: 'Search for one exact marker and read the first matched file.',
    parameters: {
      type: 'object', additionalProperties: false, required: ['query'],
      properties: { query: { type: 'string', minLength: 1 } },
    },
    steps: [
      { id: 'search', tool: 'fs.search', args: { query: { $bind: { from: 'input', path: ['query'] } } } },
      { id: 'read', tool: 'fs.read', args: { path: { $bind: { from: 'step', stepId: 'search', path: ['output', 'matches', 0, 'path'] } } } },
    ],
    output: { $bind: { from: 'step', stepId: 'read', path: ['output'] } },
  };
}

async function runCase({ mode, repetitions }) {
  const root = await mkdtemp(path.join(os.tmpdir(), `nolane-ecc-benchmark-${mode}-`));
  const store = new StudioStore(path.join(root, 'studio.db'));
  try {
    for (let index = 0; index < repetitions; index += 1) {
      await writeFile(path.join(root, `case-${index}.txt`), `needle-${index}\n`);
    }
    const project = store.createProject({ name: `ECC benchmark ${mode}`, workspaceRoot: root });
    let task = store.createTask({ projectId: project.id, title: mode, objective: 'Measure deterministic orchestration mechanics without an external model.' });
    if (mode === 'composite') task = store.updateTask(task.id, { metadata: { ...task.metadata, ephemeralCapabilityComposition: true } });

    const forge = {
      async buildContextPack(input) { return contextPack(input.task); },
      async recordEvidence() { return { status: 'unverified' }; },
    };
    const providers = new ProviderRegistry();
    let modelRequests = 0;
    let topLevelToolCalls = 0;
    let operation = 0;
    let baselineStage = 'search';
    let compositeCreated = false;

    providers.register({
      id: `${mode}-benchmark-provider`,
      publicView: () => ({ id: `${mode}-benchmark-provider`, kind: 'test' }),
      async complete({ messages, tools }) {
        modelRequests += 1;
        if (mode === 'baseline') {
          if (operation >= repetitions) return { text: 'mechanism observations recorded', toolCalls: [], usage: { totalTokens: 1 } };
          if (baselineStage === 'search') {
            baselineStage = 'read';
            topLevelToolCalls += 1;
            return { text: '', toolCalls: [{ id: `search-${operation}`, name: 'fs.search', arguments: { query: `needle-${operation}` } }], usage: { totalTokens: 1 } };
          }
          const latest = JSON.parse(messages.at(-1).content);
          const matchedPath = latest?.output?.matches?.[0]?.path;
          if (!matchedPath) throw new Error(`baseline search did not resolve a path for operation ${operation}`);
          baselineStage = 'search';
          const current = operation;
          operation += 1;
          topLevelToolCalls += 1;
          return { text: '', toolCalls: [{ id: `read-${current}`, name: 'fs.read', arguments: { path: matchedPath } }], usage: { totalTokens: 1 } };
        }

        if (!compositeCreated) {
          if (!tools.some((item) => item.function.name === 'tool.compose.create')) throw new Error('composition tool was not exposed');
          compositeCreated = true;
          topLevelToolCalls += 1;
          return { text: '', toolCalls: [{ id: 'compose', name: 'tool.compose.create', arguments: compositeDefinition() }], usage: { totalTokens: 1 } };
        }
        if (operation < repetitions) {
          if (!tools.some((item) => item.function.name === 'ephemeral.searchThenRead')) throw new Error('ephemeral capability was not exposed after creation');
          const current = operation;
          operation += 1;
          topLevelToolCalls += 1;
          return { text: '', toolCalls: [{ id: `composite-${current}`, name: 'ephemeral.searchThenRead', arguments: { query: `needle-${current}` } }], usage: { totalTokens: 1 } };
        }
        return { text: 'mechanism observations recorded', toolCalls: [], usage: { totalTokens: 1 } };
      },
    });

    const loop = new AgentLoop({
      forge,
      providers,
      broker: new ToolBroker({ workspaceRoot: root, allowedCommands: [] }),
      store,
      contextBuilder: new ContextBuilder(),
    });
    const result = await loop.run(task, {
      providerId: `${mode}-benchmark-provider`,
      budgets: { maxTurns: 64, maxToolCalls: 128, maxEstimatedTokens: 10_000, maxElapsedMs: 30_000 },
    });
    const primitiveEffects = result.activity.stepResults.filter((item) => ['fs.search', 'fs.read'].includes(item.tool)).length;
    return Object.freeze({
      mode,
      repetitions,
      modelRequests,
      topLevelToolCalls,
      primitiveEffects,
      budgetToolCalls: result.budget.toolCalls,
      receipts: result.receipts.length,
      turns: result.budget.turns,
    });
  } finally {
    store.close();
    await rm(root, { recursive: true, force: true });
  }
}

export async function runEphemeralCapabilityMechanismBenchmark({ repetitions = 4 } = {}) {
  if (!Number.isSafeInteger(repetitions) || repetitions < 1 || repetitions > 16) throw new TypeError('repetitions must be an integer between 1 and 16');
  const baseline = await runCase({ mode: 'baseline', repetitions });
  const composite = await runCase({ mode: 'composite', repetitions });
  const percent = (before, after) => Number((((before - after) / before) * 100).toFixed(2));
  return Object.freeze({
    schema: 'nolane.ecc-mechanism-benchmark.v1',
    claimClass: 'mechanism-only-no-intelligence-comparison',
    repetitions,
    baseline,
    composite,
    deltas: Object.freeze({
      modelRequestReductionPercent: percent(baseline.modelRequests, composite.modelRequests),
      topLevelToolCallReductionPercent: percent(baseline.topLevelToolCalls, composite.topLevelToolCalls),
      primitiveEffectReductionPercent: percent(baseline.primitiveEffects, composite.primitiveEffects),
      additionalGovernedBudgetUnits: composite.budgetToolCalls - baseline.budgetToolCalls,
      additionalReceipts: composite.receipts - baseline.receipts,
    }),
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.stdout.write(`${JSON.stringify(await runEphemeralCapabilityMechanismBenchmark(), null, 2)}\n`);
