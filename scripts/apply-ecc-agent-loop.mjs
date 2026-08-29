import { readFile, writeFile } from 'node:fs/promises';

const target = 'src/agent/agent-loop.mjs';
let source = await readFile(target, 'utf8');

function replaceOnce(needle, replacement, label) {
  const first = source.indexOf(needle);
  if (first < 0) throw new Error(`ECC patch marker missing: ${label}`);
  if (source.indexOf(needle, first + needle.length) >= 0) throw new Error(`ECC patch marker is ambiguous: ${label}`);
  source = source.slice(0, first) + replacement + source.slice(first + needle.length);
}

function spliceBetween(startNeedle, endNeedle, replacement, label) {
  const start = source.indexOf(startNeedle);
  if (start < 0) throw new Error(`ECC patch start marker missing: ${label}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  if (end < 0) throw new Error(`ECC patch end marker missing: ${label}`);
  source = source.slice(0, start) + replacement + source.slice(end);
}

replaceOnce(
  "import { resolveCodexAppServerExecutionPolicy } from '../providers/codex-app-server-execution-policy.mjs';",
  "import { resolveCodexAppServerExecutionPolicy } from '../providers/codex-app-server-execution-policy.mjs';\nimport { EphemeralCapabilityRegistry } from './ephemeral-capability-registry.mjs';",
  'registry import',
);

replaceOnce(
  '\n\nfunction catalogReceipt',
  `\n\nconst EPHEMERAL_CAPABILITY_COMPOSITION_SCHEMA = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'tool.compose.create',
    description: 'Create one bounded run-local composite tool from currently authorized primitive tools. The composite gains no new authority and expires when this run ends.',
    parameters: Object.freeze({
      type: 'object',
      additionalProperties: false,
      required: ['name', 'description', 'parameters', 'steps', 'output'],
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$' },
        description: { type: 'string', minLength: 1, maxLength: 1000 },
        parameters: { type: 'object' },
        steps: {
          type: 'array', minItems: 1, maxItems: 8,
          items: {
            type: 'object', additionalProperties: false, required: ['id', 'tool', 'args'],
            properties: {
              id: { type: 'string', minLength: 1, maxLength: 64 },
              tool: { type: 'string', minLength: 1, maxLength: 128 },
              args: { type: 'object' },
            },
          },
        },
        output: { type: ['object', 'array', 'string', 'number', 'integer', 'boolean', 'null'] },
      },
    }),
  }),
});\n\nfunction catalogReceipt`,
  'composition schema insertion',
);

replaceOnce(
  "    const dynamicToolDiscovery = task.metadata?.dynamicToolDiscovery === true && this.dynamicToolCatalog;\n    let authorizedToolSchemas = new Map(baseTools.map((schema) => [schema.function.name, schema]));",
  "    const dynamicToolDiscovery = task.metadata?.dynamicToolDiscovery === true && this.dynamicToolCatalog;\n    const ephemeralCapabilityComposition = task.metadata?.ephemeralCapabilityComposition === true;\n    const ephemeralCapabilities = ephemeralCapabilityComposition ? new EphemeralCapabilityRegistry({ runId: run.id, taskId: task.id }) : null;\n    let primitiveToolSchemas = new Map(baseTools.map((schema) => [schema.function.name, schema]));\n    let catalogAuthorizedToolSchemas = new Map(primitiveToolSchemas);\n    let authorizedToolSchemas = new Map(primitiveToolSchemas);",
  'run-local composition state',
);

spliceBetween(
  '      authorizedToolSchemas = new Map(activeTools.map((schema) => [schema.function.name, schema]));',
  '      const sessionStartHook',
  `      primitiveToolSchemas = new Map(activeTools.map((schema) => [schema.function.name, schema]));
      catalogAuthorizedToolSchemas = new Map(primitiveToolSchemas);
      authorizedToolSchemas = new Map(primitiveToolSchemas);
      if (dynamicToolDiscovery) {
        const pinned = new Set(this.dynamicToolCatalog.baseSchemas().map((schema) => schema.function.name));
        activeTools = Object.freeze([
          ...[...primitiveToolSchemas.values()].filter((schema) => pinned.has(schema.function.name)),
          ...DYNAMIC_TOOL_DISCOVERY_SCHEMAS,
          ...(ephemeralCapabilityComposition ? [EPHEMERAL_CAPABILITY_COMPOSITION_SCHEMA] : []),
        ]);
        this.#event('agent.tool-catalog.enabled', { authorizedToolCount: primitiveToolSchemas.size, initiallyLoaded: activeTools.map((schema) => schema.function.name) }, refs);
      } else if (ephemeralCapabilityComposition) {
        activeTools = Object.freeze([...activeTools, EPHEMERAL_CAPABILITY_COMPOSITION_SCHEMA]);
      }
      for (const schema of activeTools) authorizedToolSchemas.set(schema.function.name, schema);\n`,
  'authorized tool setup',
);

replaceOnce(
  "      await runHook('BeforeAgent', { objective: task.objective, contextPackSha256: contextPack.contextPackSha256 });\n\n      let activeHarness",
  `      await runHook('BeforeAgent', { objective: task.objective, contextPackSha256: contextPack.contextPackSha256 });\n\n      const executeGovernedTool = async ({ name, args = {}, callId, origin = 'model', parentCompositeId = null, childStepId = null, appendModelMessage = true, consumePrimitiveBudget = false } = {}) => {
        if (consumePrimitiveBudget) budget.consumeToolCalls(1);
        const requestedName = String(name ?? '');
        const requestedArguments = args && typeof args === 'object' ? args : {};
        const beforeTool = await runHook('BeforeTool', { toolName: requestedName, arguments: requestedArguments, origin, parentCompositeId, childStepId });
        const effectiveName = String(beforeTool?.payload?.toolName ?? requestedName);
        const effectiveArguments = beforeTool?.payload?.arguments && typeof beforeTool.payload.arguments === 'object'
          ? beforeTool.payload.arguments
          : requestedArguments;
        if (beforeTool?.allowedTools && !beforeTool.allowedTools.includes(effectiveName)) {
          const error = new Error(\`Lifecycle hook removed authorization for tool: \${effectiveName}\`);
          error.code = 'HOOK_POLICY_DENIED';
          throw error;
        }
        if (!activeTools.some((schema) => schema.function.name === effectiveName)) {
          const error = new Error(\`Lifecycle hook selected an unauthorized tool: \${effectiveName}\`);
          error.code = 'HOOK_TOOL_REWRITE_DENIED';
          throw error;
        }
        if (origin === 'composite') {
          if (effectiveName !== requestedName) {
            const error = new Error(\`Lifecycle hook cannot rewrite a composite primitive tool: \${requestedName} -> \${effectiveName}\`);
            error.code = 'EPHEMERAL_CAPABILITY_TOOL_REWRITE_DENIED';
            throw error;
          }
          if (!primitiveToolSchemas.has(effectiveName)) {
            const error = new Error(\`Composite primitive is no longer authorized: \${effectiveName}\`);
            error.code = 'EPHEMERAL_CAPABILITY_PRIMITIVE_INACTIVE';
            throw error;
          }
        }
        activity.assertActionAllowed({ tool: effectiveName, input: effectiveArguments });
        if (task.metadata?.taskContract) {
          if (effectiveName.startsWith('fs.')) {
            const pathValue = effectiveArguments.path ?? effectiveArguments.to ?? effectiveArguments.from;
            const kind = ['fs.read', 'fs.readMany', 'fs.search'].includes(effectiveName) ? 'file.read' : 'file.write';
            if (effectiveName === 'fs.readMany') for (const candidate of effectiveArguments.paths ?? []) assertTaskActionAllowed(task.metadata.taskContract, { kind, path: candidate });
            else if (pathValue) assertTaskActionAllowed(task.metadata.taskContract, { kind, path: pathValue });
          } else if (effectiveName === 'process.run' || effectiveName === 'process.startManaged') assertTaskActionAllowed(task.metadata.taskContract, { kind: 'process.run', command: effectiveArguments.command });
          else if (effectiveName === 'git.commit') assertTaskActionAllowed(task.metadata.taskContract, { kind: 'git.commit' });
        }
        const broker = typeof this.broker === 'function' ? this.broker(task) : this.broker;
        const target = toolTarget(effectiveName, effectiveArguments);
        const executionMeta = { origin, parentCompositeId, childStepId };
        this.#event('agent.tool.started', { turn, tool: effectiveName, target, ...executionMeta }, refs);
        let result;
        if (effectiveName === 'tool.catalog.search') {
          const authorizedNames = new Set(catalogAuthorizedToolSchemas.keys());
          const items = this.dynamicToolCatalog.search(String(effectiveArguments.query ?? ''), { limit: effectiveArguments.limit ?? 20 })
            .filter((item) => authorizedNames.has(item.name));
          const catalogOutput = Object.freeze({ schema: 'forge.dynamic-tool-search.v1', items: Object.freeze(items) });
          result = Object.freeze({ status: 'pass', output: catalogOutput, receipt: catalogReceipt({ tool: effectiveName, input: effectiveArguments, output: catalogOutput, refs }) });
        } else if (effectiveName === 'tool.catalog.load') {
          const toolName = String(effectiveArguments.name ?? '');
          const schema = catalogAuthorizedToolSchemas.get(toolName);
          if (!schema) {
            const error = new Error(\`Tool is not authorized for this task: \${toolName}\`);
            error.code = 'DYNAMIC_TOOL_NOT_AUTHORIZED';
            throw error;
          }
          if (!activeTools.some((item) => item.function.name === toolName)) activeTools = Object.freeze([...activeTools, schema]);
          const summary = this.dynamicToolCatalog.summary(toolName);
          const catalogOutput = Object.freeze({ schema: 'forge.dynamic-tool-load.v1', tool: summary, loaded: true });
          result = Object.freeze({ status: 'pass', output: catalogOutput, receipt: catalogReceipt({ tool: effectiveName, input: effectiveArguments, output: catalogOutput, refs }) });
          this.#event('agent.tool-schema.loaded', { tool: toolName, source: summary.source, capability: summary.capability }, refs);
        } else if (effectiveName === 'tool.compose.create') {
          if (!ephemeralCapabilities) {
            const error = new Error('Ephemeral capability composition is not enabled for this task');
            error.code = 'EPHEMERAL_CAPABILITY_DISABLED';
            throw error;
          }
          this.#event('agent.capability.proposed', { requestedName: String(effectiveArguments.name ?? ''), primitiveCount: Array.isArray(effectiveArguments.steps) ? effectiveArguments.steps.length : 0 }, refs);
          let registered;
          try {
            registered = ephemeralCapabilities.register(effectiveArguments, { primitiveSchemas: primitiveToolSchemas });
          } catch (error) {
            this.#event('agent.capability.rejected', { requestedName: String(effectiveArguments.name ?? ''), code: String(error?.code ?? 'EPHEMERAL_CAPABILITY_REJECTED'), reason: String(error?.message ?? error).slice(0, 500) }, refs);
            throw error;
          }
          if (!activeTools.some((item) => item.function.name === registered.name)) activeTools = Object.freeze([...activeTools, registered.schema]);
          authorizedToolSchemas.set(registered.name, registered.schema);
          const capabilityOutput = Object.freeze({
            schema: 'forge.ephemeral-capability-created.v1',
            tool: Object.freeze({ name: registered.name, description: registered.schema.function.description, parameters: registered.schema.function.parameters }),
            definitionReceiptSha256: registered.receipt.receiptSha256,
          });
          result = Object.freeze({ status: 'pass', output: capabilityOutput, receipt: registered.receipt });
          this.#event('agent.capability.registered', { tool: registered.name, primitiveTools: registered.receipt.primitiveTools, definitionReceiptSha256: registered.receipt.receiptSha256 }, refs);
        } else if (effectiveName.startsWith('ephemeral.')) {
          if (!ephemeralCapabilities?.get(effectiveName)) {
            const error = new Error(\`Unknown run-local capability: \${effectiveName}\`);
            error.code = 'EPHEMERAL_CAPABILITY_UNKNOWN';
            throw error;
          }
          result = await ephemeralCapabilities.invoke(effectiveName, effectiveArguments, {
            isPrimitiveActive: (primitiveName) => primitiveToolSchemas.has(primitiveName) && activeTools.some((schema) => schema.function.name === primitiveName),
            executePrimitive: ({ name: primitiveName, args: primitiveArgs, parentCompositeId: compositeId, childStepId: stepId }) => executeGovernedTool({
              name: primitiveName,
              args: primitiveArgs,
              callId: \`\${String(callId ?? effectiveName)}:\${stepId}\`,
              origin: 'composite',
              parentCompositeId: compositeId,
              childStepId: stepId,
              appendModelMessage: false,
              consumePrimitiveBudget: true,
            }),
          });
        } else result = mcpToolNames.has(effectiveName)
          ? await this.mcpGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
          : browserToolNames.has(effectiveName)
            ? await this.browserGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
            : goalToolNames.has(effectiveName)
              ? await this.goalGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
              : forgeToolNames.has(effectiveName)
                ? await this.forgeGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
                : operatingPlaneToolNames.has(effectiveName)
                  ? await this.operatingPlaneGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
                  : adaptiveIntelligenceToolNames.has(effectiveName)
                    ? await this.adaptiveIntelligenceGateway.execute(task, effectiveName, effectiveArguments, { signal, refs })
                    : await broker.execute({ tool: effectiveName, input: effectiveArguments }, { signal, refs, principalId: \`agent:\${task.id}\`, projectId: task.projectId, taskId: task.id, sessionId: run.id, origin: origin === 'composite' ? 'agent-composite' : 'agent' });
        receipts.push(result.receipt);
        activity.recordTool({ tool: effectiveName, input: effectiveArguments, status: result.status, output: result.output, receiptSha256: result.receipt?.receiptSha256 ?? null });
        await this.forge.recordEvidence(task.projectId, {
          type: 'tool-receipt',
          title: \`\${effectiveName} execution receipt\`,
          summary: \`Tool \${effectiveName} returned \${result.status}.\`,
          metadata: { taskId: task.id, runId: run.id, toolCallId: callId, receiptSha256: result.receipt.receiptSha256, ...executionMeta },
        });
        if (appendModelMessage) {
          const renderedToolResult = JSON.stringify({ status: result.status, output: result.output, receipt: result.receipt });
          const screenedToolResult = screenContent('tool', \`\${effectiveName}:\${callId}\`, renderedToolResult);
          messages.push({ role: 'tool', tool_call_id: callId, content: screenedToolResult.safeText });
        }
        this.#event('agent.tool.completed', { turn, tool: effectiveName, target, status: result.status, ...toolResultMeta(result), receiptSha256: result.receipt.receiptSha256, ...executionMeta }, refs);
        await runHook('AfterTool', { toolName: effectiveName, arguments: effectiveArguments, status: result.status, receiptSha256: result.receipt.receiptSha256, ...executionMeta });
        return result;
      };\n\n      let activeHarness`,
  'governed executor insertion',
);

spliceBetween(
  '        budget.consumeToolCalls(response.toolCalls.length);',
  "        this.store.updateRun(run.id, { state: 'running'",
  `        budget.consumeToolCalls(response.toolCalls.length);\n        const selectionHook = await runHook('BeforeToolSelection', { turn, toolCalls: response.toolCalls });\n        const selectedCalls = Array.isArray(selectionHook?.payload?.toolCalls) ? selectionHook.payload.toolCalls : response.toolCalls;\n        for (const call of selectedCalls) {\n          await executeGovernedTool({ name: call.name, args: call.arguments ?? {}, callId: call.id, origin: 'model', appendModelMessage: true });\n        }\n`,
  'top-level tool dispatch',
);

if (!source.includes("name: 'tool.compose.create'")) throw new Error('ECC patch invariant failed: composition schema absent');
if (!source.includes('const executeGovernedTool = async')) throw new Error('ECC patch invariant failed: governed executor absent');
if (!source.includes('consumePrimitiveBudget: true')) throw new Error('ECC patch invariant failed: primitive budget accounting absent');
if ((source.match(/EphemeralCapabilityRegistry/g) ?? []).length !== 2) throw new Error('ECC patch invariant failed: unexpected registry references');

await writeFile(target, source, 'utf8');
console.log(JSON.stringify({ status: 'patched', target, bytes: Buffer.byteLength(source, 'utf8') }));
