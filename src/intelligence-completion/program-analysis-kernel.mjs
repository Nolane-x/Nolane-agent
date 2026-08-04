import { boundedArray, finite, sha, signed, text } from './completion-utils.mjs';

function citation(value, label) {
  const path = text(value?.path, `${label}.path`, 4_096).replaceAll('\\', '/').replace(/^\.\//, '');
  const startLine = Math.max(1, Math.floor(finite(value?.startLine ?? 1, `${label}.startLine`, 1, 10_000_000)));
  const endLine = Math.max(startLine, Math.floor(finite(value?.endLine ?? startLine, `${label}.endLine`, startLine, 10_000_000)));
  return { path, startLine, endLine, sourceHash: sha(value?.sourceHash, `${label}.sourceHash`) };
}
function stringArray(value, label, max = 10_000) { return boundedArray(value ?? [], label, max).map((item, index) => text(item, `${label}[${index}]`, 512)); }

function normalizeProgram(input, maximumFunctions, maximumInputNodes) {
  const repositoryId = text(input.repositoryId, 'repositoryId', 512); const branch = text(input.branch, 'branch', 512);
  const rawFunctions = boundedArray(input.functions, 'functions', maximumFunctions); const functionIds = new Set(); let totalInputNodes = 0;
  const functions = rawFunctions.map((fn, functionIndex) => {
    const id = text(fn?.id, `functions[${functionIndex}].id`, 512); if (functionIds.has(id)) throw new Error(`duplicate function id: ${id}`); functionIds.add(id);
    const rawNodes = boundedArray(fn?.nodes, `functions[${functionIndex}].nodes`, maximumInputNodes); totalInputNodes += rawNodes.length; if (totalInputNodes > maximumInputNodes) throw new RangeError(`input nodes exceed maximum ${maximumInputNodes}`);
    const nodeIds = new Set();
    const nodes = rawNodes.map((node, nodeIndex) => {
      const nodeId = text(node?.id, `functions[${functionIndex}].nodes[${nodeIndex}].id`, 512); if (nodeIds.has(nodeId)) throw new Error(`duplicate node id in ${id}: ${nodeId}`); nodeIds.add(nodeId);
      return { id: nodeId, kind: text(node?.kind ?? 'statement', `functions[${functionIndex}].nodes[${nodeIndex}].kind`, 128), next: stringArray(node?.next, `functions[${functionIndex}].nodes[${nodeIndex}].next`, 128), reads: stringArray(node?.reads, `functions[${functionIndex}].nodes[${nodeIndex}].reads`, 1_000), writes: stringArray(node?.writes, `functions[${functionIndex}].nodes[${nodeIndex}].writes`, 1_000), citation: citation(node?.citation, `functions[${functionIndex}].nodes[${nodeIndex}].citation`) };
    });
    for (const node of nodes) for (const target of node.next) if (!nodeIds.has(target)) throw new Error(`unknown CFG target in ${id}: ${target}`);
    const entry = text(fn?.entry, `functions[${functionIndex}].entry`, 512); if (!nodeIds.has(entry)) throw new Error(`entry node not found in ${id}: ${entry}`);
    const calls = boundedArray(fn?.calls ?? [], `functions[${functionIndex}].calls`, 10_000).map((call, callIndex) => {
      const fromNodeId = text(call?.fromNodeId, `functions[${functionIndex}].calls[${callIndex}].fromNodeId`, 512); if (!nodeIds.has(fromNodeId)) throw new Error(`call source node not found in ${id}: ${fromNodeId}`);
      const dynamic = call?.dynamic === true; const targetFunctionId = call?.targetFunctionId == null ? null : text(call.targetFunctionId, `functions[${functionIndex}].calls[${callIndex}].targetFunctionId`, 512);
      return { fromNodeId, targetFunctionId, dynamic, confidence: finite(call?.confidence ?? (dynamic ? 0 : 1), `functions[${functionIndex}].calls[${callIndex}].confidence`, 0, 1), citation: citation(call?.citation, `functions[${functionIndex}].calls[${callIndex}].citation`) };
    });
    return { id, entry, nodes, calls };
  });
  return { repositoryId, branch, functions, functionIds, totalInputNodes };
}

function reachableAndBackEdges(fn, includedIds) {
  const byId = new Map(fn.nodes.filter((node) => includedIds.has(node.id)).map((node) => [node.id, node]));
  const reachable = new Set(); const active = new Set(); const visited = new Set(); const back = new Set();
  function visit(id) {
    if (!byId.has(id)) return;
    reachable.add(id);
    if (active.has(id) || visited.has(id)) return;
    active.add(id);
    const node = byId.get(id);
    for (const target of node.next) {
      if (!byId.has(target)) continue;
      if (active.has(target)) back.add(`${id}\u0000${target}`);
      visit(target);
    }
    active.delete(id); visited.add(id);
  }
  visit(fn.entry);
  return { reachable, back };
}

export class ProgramAnalysisKernel {
  constructor({ maximumFunctions = 2_000, maximumInputNodes = 100_000, maximumNodes = 50_000, maximumEdges = 200_000, maximumInterproceduralDepth = 3 } = {}) {
    this.maximumFunctions = Math.max(1, Math.min(20_000, Math.floor(Number(maximumFunctions) || 2_000)));
    this.maximumInputNodes = Math.max(1, Math.min(1_000_000, Math.floor(Number(maximumInputNodes) || 100_000)));
    this.maximumNodes = Math.max(1, Math.min(this.maximumInputNodes, Math.floor(Number(maximumNodes) || 50_000)));
    this.maximumEdges = Math.max(1, Math.min(2_000_000, Math.floor(Number(maximumEdges) || 200_000)));
    this.maximumInterproceduralDepth = Math.max(0, Math.min(16, Math.floor(Number(maximumInterproceduralDepth) || 3)));
    this.reports = [];
  }

  #program(input) { return normalizeProgram(input, this.maximumFunctions, this.maximumInputNodes); }

  buildControlFlow(input = {}) {
    const program = this.#program(input); let remainingNodes = this.maximumNodes; let remainingEdges = this.maximumEdges; let truncated = program.totalInputNodes > this.maximumNodes;
    const functions = []; const callEdges = [];
    for (const fn of program.functions) {
      const selected = fn.nodes.slice(0, remainingNodes); remainingNodes -= selected.length;
      const includedIds = new Set(selected.map((node) => node.id)); const analysis = reachableAndBackEdges(fn, includedIds);
      const edges = [];
      for (const node of selected) for (const target of node.next) {
        if (!includedIds.has(target)) { truncated = true; continue; }
        if (remainingEdges <= 0) { truncated = true; break; }
        edges.push({ from: node.id, to: target, kind: node.kind === 'branch' ? 'branch' : 'next', backEdge: analysis.back.has(`${node.id}\u0000${target}`), citation: node.citation }); remainingEdges -= 1;
      }
      const nodes = selected.map((node) => ({ nodeId: node.id, kind: node.kind, reads: node.reads, writes: node.writes, citation: node.citation }));
      const unreachableNodeIds = selected.filter((node) => !analysis.reachable.has(node.id)).map((node) => node.id).sort();
      functions.push({ functionId: fn.id, entryNodeId: includedIds.has(fn.entry) ? fn.entry : null, nodes, edges, unreachableNodeIds });
      for (const call of fn.calls) {
        if (!includedIds.has(call.fromNodeId)) { truncated = true; continue; }
        if (remainingEdges <= 0) { truncated = true; break; }
        const targetExists = call.targetFunctionId != null && program.functionIds.has(call.targetFunctionId);
        callEdges.push({ fromFunctionId: fn.id, fromNodeId: call.fromNodeId, targetFunctionId: targetExists ? call.targetFunctionId : null, ambiguous: call.dynamic || !targetExists, confidence: call.confidence, citation: call.citation, reason: call.dynamic ? 'dynamic-call-target-unresolved' : targetExists ? 'direct-call' : 'target-function-missing' }); remainingEdges -= 1;
      }
      if (remainingNodes <= 0) { if (functions.length < program.functions.length) truncated = true; break; }
    }
    const nodeCount = functions.reduce((sum, fn) => sum + fn.nodes.length, 0); const edgeCount = functions.reduce((sum, fn) => sum + fn.edges.length, 0) + callEdges.length;
    const receipt = signed({ schema: 'forge.program-control-flow.v1', repositoryId: program.repositoryId, branch: program.branch, functions, callEdges, nodeCount, edgeCount, truncated, budgets: { maximumNodes: this.maximumNodes, maximumEdges: this.maximumEdges }, claims: { dynamicTargetsGuessed: false, wholeProgramCompletenessClaimed: false } });
    this.reports.push(receipt); return receipt;
  }

  buildDataFlow(input = {}) {
    const program = this.#program(input); let edgeBudget = this.maximumEdges; let nodeBudget = this.maximumNodes; let truncated = false;
    const edges = []; const ambiguousFlows = []; const summaries = new Map();
    for (const fn of program.functions) {
      if (nodeBudget <= 0) { truncated = true; break; }
      const selected = fn.nodes.slice(0, nodeBudget); nodeBudget -= selected.length; if (selected.length < fn.nodes.length) truncated = true;
      const lastWriter = new Map(); const unresolvedReads = [];
      for (const node of selected) {
        for (const symbol of node.reads) {
          const writer = lastWriter.get(symbol);
          if (writer && edgeBudget > 0) { edges.push({ symbol, fromFunctionId: fn.id, fromNodeId: writer.id, toFunctionId: fn.id, toNodeId: node.id, scope: 'intraprocedural', confidence: 1, fromCitation: writer.citation, toCitation: node.citation }); edgeBudget -= 1; }
          else unresolvedReads.push({ symbol, nodeId: node.id, citation: node.citation });
        }
        for (const symbol of node.writes) lastWriter.set(symbol, node);
      }
      summaries.set(fn.id, { selected, unresolvedReads, finalWriters: new Map(lastWriter), calls: fn.calls });
      if (edgeBudget <= 0) truncated = true;
    }

    if (this.maximumInterproceduralDepth > 0 && edgeBudget > 0) {
      for (const fn of program.functions) {
        const summary = summaries.get(fn.id); if (!summary) continue;
        for (const call of fn.calls) {
          if (call.dynamic || !call.targetFunctionId || !summaries.has(call.targetFunctionId)) {
            ambiguousFlows.push({ fromFunctionId: fn.id, fromNodeId: call.fromNodeId, targetFunctionId: call.targetFunctionId, reason: call.dynamic ? 'dynamic-call-target-unresolved' : 'target-function-missing', confidence: call.confidence, citation: call.citation });
            continue;
          }
          const target = summaries.get(call.targetFunctionId);
          const callIndex = summary.selected.findIndex((node) => node.id === call.fromNodeId); if (callIndex < 0) { truncated = true; continue; }
          const available = new Map();
          for (const node of summary.selected.slice(0, callIndex + 1)) for (const symbol of node.writes) available.set(symbol, node);
          for (const read of target.unresolvedReads) {
            const writer = available.get(read.symbol); if (!writer) continue;
            if (edgeBudget <= 0) { truncated = true; break; }
            edges.push({ symbol: read.symbol, fromFunctionId: fn.id, fromNodeId: writer.id, toFunctionId: call.targetFunctionId, toNodeId: read.nodeId, scope: 'interprocedural', depth: 1, confidence: Math.min(1, call.confidence), fromCitation: writer.citation, toCitation: read.citation, callCitation: call.citation }); edgeBudget -= 1;
          }
        }
      }
    }
    const receipt = signed({ schema: 'forge.program-data-flow.v1', repositoryId: program.repositoryId, branch: program.branch, edges, ambiguousFlows, nodeCount: this.maximumNodes - nodeBudget, edgeCount: edges.length, truncated, budgets: { maximumNodes: this.maximumNodes, maximumEdges: this.maximumEdges, maximumInterproceduralDepth: this.maximumInterproceduralDepth }, claims: { dynamicTargetsGuessed: false, wholeProgramCompletenessClaimed: false, ambiguousFlowsRetained: true } });
    this.reports.push(receipt); return receipt;
  }

  snapshot() { return signed({ schema: 'forge.program-analysis-kernel-snapshot.v1', reports: this.reports.slice(-50).map((report) => ({ schema: report.schema, receiptSha256: report.receiptSha256, nodeCount: report.nodeCount, edgeCount: report.edgeCount, truncated: report.truncated })), claims: { sourceTextStored: false } }); }
}
