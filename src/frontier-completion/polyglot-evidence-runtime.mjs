import { createHash } from 'node:crypto';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
}
function freeze(value) {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, child]) => [key, freeze(child)])));
}
function required(value, label) { const text = String(value ?? '').trim(); if (!text) throw new TypeError(`${label} is required`); return text; }
function citation(raw) {
  if (!raw || typeof raw !== 'object') throw new TypeError('citation is required');
  const output = { path: required(raw.path, 'citation.path'), symbol: raw.symbol == null ? null : String(raw.symbol), sourceHash: required(raw.sourceHash, 'citation.sourceHash'), startLine: Number(raw.startLine ?? 1), endLine: Number(raw.endLine ?? raw.startLine ?? 1) };
  if (!/^[a-f0-9]{64}$/i.test(output.sourceHash) || !Number.isInteger(output.startLine) || !Number.isInteger(output.endLine) || output.startLine < 1 || output.endLine < output.startLine) throw new TypeError('citation is invalid');
  return freeze(output);
}
function confidence(value, fallback = 1) { const number = value == null ? fallback : Number(value); if (!Number.isFinite(number) || number < 0 || number > 1) throw new TypeError('confidence must be between 0 and 1'); return number; }
function edge(raw) {
  const base = { kind: required(raw.kind, 'edge.kind'), from: required(raw.from, 'edge.from'), to: required(raw.to, 'edge.to'), language: raw.language == null ? null : String(raw.language), confidence: confidence(raw.confidence), ambiguous: Boolean(raw.ambiguous), citation: citation(raw.citation), ...(raw.lines ? { lines: freeze([...raw.lines].map(Number)) } : {}), ...(raw.metadata ? { metadata: freeze(raw.metadata) } : {}) };
  return freeze({ ...base, receiptSha256: sha256(canonical(base)) });
}
function graph(schema, nodes, edges) { return freeze({ schema, nodes: [...nodes].sort().map((id) => ({ id })), edges: [...edges] }); }

export class PolyglotEvidenceRuntime {
  constructor() {
    this.calls = []; this.types = []; this.buildNodes = new Set(); this.buildEdges = []; this.testNodes = new Set(); this.testEdges = []; this.runtimeNodes = new Set(); this.runtimeEdges = []; this.resourceAccess = [];
  }

  ingestCalls(records = []) {
    for (const record of records) {
      const from = required(record.from, 'call.from');
      if (record.to) this.calls.push(edge({ kind: 'call', from, to: record.to, language: record.language, confidence: record.confidence, ambiguous: Boolean(record.ambiguous), citation: record.citation }));
      else {
        const candidates = Array.isArray(record.candidates) ? record.candidates : [];
        if (!candidates.length) throw new TypeError('call.to or call.candidates is required');
        for (const target of candidates) this.calls.push(edge({ kind: 'dynamic-call', from, to: target, language: record.language, confidence: record.confidence, ambiguous: true, citation: record.citation, metadata: { candidateCount: candidates.length } }));
      }
    }
    return this.callGraph();
  }
  callGraph() { return graph('forge.polyglot-call-graph.v1', new Set(this.calls.flatMap((item) => [item.from, item.to])), this.calls); }

  ingestTypes(records = []) {
    for (const record of records) this.types.push(edge({ kind: record.kind, from: record.from, to: record.to, language: record.language, confidence: record.confidence, ambiguous: record.ambiguous, citation: record.citation }));
    return this.typeGraph();
  }
  typeGraph() { return graph('forge.polyglot-type-graph.v1', new Set(this.types.flatMap((item) => [item.from, item.to])), this.types); }

  ingestBuild({ packages = [], compilerTargets = [], workspaces = [] } = {}) {
    for (const pkg of packages) {
      const id = required(pkg.id, 'package.id'); this.buildNodes.add(id); const cite = citation(pkg.citation);
      for (const dependency of pkg.dependsOn ?? []) { this.buildNodes.add(String(dependency)); this.buildEdges.push(edge({ kind: 'package-dependency', from: id, to: dependency, confidence: 1, citation: cite, metadata: { manager: String(pkg.manager ?? 'unknown') } })); }
    }
    for (const target of compilerTargets) {
      const id = required(target.id, 'compilerTarget.id'); this.buildNodes.add(id); const cite = citation(target.citation);
      for (const output of target.outputs ?? []) { this.buildNodes.add(String(output)); this.buildEdges.push(edge({ kind: 'compiler-output', from: id, to: output, confidence: 1, citation: cite, metadata: { compiler: String(target.compiler ?? 'unknown') } })); }
    }
    for (const workspace of workspaces) {
      const id = required(workspace.id, 'workspace.id'); this.buildNodes.add(id); const cite = citation(workspace.citation);
      for (const member of workspace.members ?? []) { this.buildNodes.add(String(member)); this.buildEdges.push(edge({ kind: 'workspace-member', from: id, to: member, confidence: 1, citation: cite })); }
    }
    return this.buildGraph();
  }
  buildGraph() { return graph('forge.polyglot-build-graph.v1', this.buildNodes, this.buildEdges); }

  ingestTests({ tests = [], coverage = [] } = {}) {
    for (const test of tests) {
      const id = required(test.id, 'test.id'); this.testNodes.add(id); const cite = citation(test.citation);
      for (const target of test.targets ?? []) { this.testNodes.add(String(target)); this.testEdges.push(edge({ kind: 'tests-symbol', from: id, to: target, confidence: 1, citation: cite })); }
    }
    for (const item of coverage) {
      const testId = required(item.testId, 'coverage.testId'); const symbol = required(item.symbol, 'coverage.symbol'); this.testNodes.add(testId); this.testNodes.add(symbol);
      const lines = [...new Set((item.lines ?? []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
      if (!lines.length) throw new TypeError('coverage lines are required');
      this.testEdges.push(edge({ kind: 'covers-lines', from: testId, to: symbol, confidence: 1, citation: item.citation, lines, metadata: { path: required(item.path, 'coverage.path') } }));
    }
    return this.testGraph();
  }
  testGraph() { return graph('forge.polyglot-test-graph.v1', this.testNodes, this.testEdges); }

  ingestRuntime({ traceId, permissionReceipt, observations = [] } = {}) {
    const id = required(traceId, 'traceId');
    if (!permissionReceipt || !Array.isArray(permissionReceipt.scope) || !/^[a-f0-9]{64}$/i.test(String(permissionReceipt.receiptSha256 ?? ''))) throw new TypeError('runtime observation permission receipt is required');
    const permitted = new Set(permissionReceipt.scope.map(String));
    if (!permitted.has('runtime.trace')) throw new TypeError('runtime.trace permission is required');
    for (const observation of observations) {
      const kind = required(observation.kind, 'observation.kind'); const atMs = Number(observation.atMs);
      if (!Number.isFinite(atMs)) throw new TypeError('observation.atMs is required');
      const runtimeCitation = freeze({ path: `runtime://${id}`, symbol: observation.symbol ?? observation.from ?? null, sourceHash: String(permissionReceipt.receiptSha256), startLine: Math.max(1, Math.floor(atMs) + 1), endLine: Math.max(1, Math.floor(atMs) + 1) });
      const metadata = { traceId: id, atMs, permissionReceiptSha256: permissionReceipt.receiptSha256, operation: observation.operation ?? null, method: observation.method ?? null };
      if (kind === 'call') this.runtimeEdges.push(edge({ kind: 'runtime-call', from: observation.from, to: observation.to, confidence: 1, citation: runtimeCitation, metadata }));
      else if (kind === 'exception') this.runtimeEdges.push(edge({ kind: 'exception-path', from: observation.symbol, to: observation.errorType, confidence: 1, citation: runtimeCitation, metadata }));
      else if (kind === 'request') this.runtimeEdges.push(edge({ kind: 'request', from: observation.symbol, to: observation.target, confidence: 1, citation: runtimeCitation, metadata }));
      else if (kind === 'event') this.runtimeEdges.push(edge({ kind: 'event', from: observation.symbol, to: observation.name, confidence: 1, citation: runtimeCitation, metadata }));
      else if (kind === 'state-transition') this.runtimeEdges.push(edge({ kind: 'state-transition', from: observation.from, to: observation.to, confidence: 1, citation: runtimeCitation, metadata: { ...metadata, symbol: observation.symbol } }));
      else if (kind === 'database-query') {
        if (!permitted.has('database.observe')) throw new TypeError('database.observe permission is required');
        this.runtimeEdges.push(edge({ kind: 'database-query', from: observation.symbol, to: observation.target, confidence: 1, citation: runtimeCitation, metadata }));
      } else if (['file-access', 'network-access', 'process-access'].includes(kind)) {
        if (!permitted.has('resource.observe')) throw new TypeError('resource.observe permission is required');
        const recordBase = { kind, operation: required(observation.operation, 'resource operation'), target: required(observation.target, 'resource target'), symbol: required(observation.symbol, 'resource symbol'), taskId: required(observation.taskId, 'resource taskId'), traceId: id, atMs, permissionReceiptSha256: permissionReceipt.receiptSha256 };
        const record = freeze({ ...recordBase, receiptSha256: sha256(canonical(recordBase)) }); this.resourceAccess.push(record);
        this.runtimeEdges.push(edge({ kind, from: record.symbol, to: record.target, confidence: 1, citation: runtimeCitation, metadata: { ...metadata, taskId: record.taskId } }));
      } else throw new TypeError(`unsupported runtime observation: ${kind}`);
    }
    for (const item of this.runtimeEdges) { this.runtimeNodes.add(item.from); this.runtimeNodes.add(item.to); }
    const base = { schema: 'forge.polyglot-runtime-ingest.v1', traceId: id, observations: observations.length, permissionReceiptSha256: permissionReceipt.receiptSha256 };
    return freeze({ ...base, receiptSha256: sha256(canonical(base)) });
  }
  runtimeGraph() { return graph('forge.polyglot-runtime-graph.v1', this.runtimeNodes, this.runtimeEdges); }
  resourceAttribution() { return freeze([...this.resourceAccess]); }
}
