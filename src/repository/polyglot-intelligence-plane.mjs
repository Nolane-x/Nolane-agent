import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LanguageCapabilityMatrix } from './language-capability-matrix.mjs';
import { SourceClassifier } from './source-classifier.mjs';
import { FrameworkCapabilityRegistry } from './framework-capability-registry.mjs';
import { RelationshipGraphFusionService } from './relationship-graph-fusion-service.mjs';
import { RuntimeObservationStore } from './runtime-observation-store.mjs';
import { ArchitectureDriftSentinel } from './architecture-drift-sentinel.mjs';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
const execFileAsync = promisify(execFile);
function freeze(value) { if (!value || typeof value !== 'object') return value; if (Array.isArray(value)) { value.forEach(freeze); return Object.freeze(value); } Object.values(value).forEach(freeze); return Object.freeze(value); }
function parseVersion(output) {
  const text = String(output ?? '').trim();
  if (!text) return 'unknown';
  const semantic = text.match(/\b(?:version\s+)?(\d+\.\d+(?:\.\d+)?(?:[-+][A-Za-z0-9.-]+)?)\b/i);
  return semantic?.[1] ?? 'installed';
}
export async function probeLanguageServerCommand(command, { runner = execFileAsync } = {}) {
  const options = { timeout: 3000, maxBuffer: 128000, windowsHide: true };
  try {
    const { stdout = '', stderr = '' } = await runner(command, ['--version'], options);
    return { available: true, version: parseVersion(stdout || stderr), probe: 'version' };
  } catch (error) {
    if (error?.code === 'ENOENT') return { available: false, version: null, reason: 'not-installed' };
    try {
      const { stdout = '', stderr = '' } = await runner(command, ['--help'], options);
      const text = String(stdout || stderr).trim();
      if (!text) return { available: false, version: null, reason: 'probe-failed' };
      return { available: true, version: parseVersion(text), probe: 'help' };
    } catch (fallbackError) {
      return { available: false, version: null, reason: fallbackError?.code === 'ENOENT' ? 'not-installed' : 'probe-failed' };
    }
  }
}
async function defaultProbe(command) { return probeLanguageServerCommand(command); }
function cap(status, provider, version=null, reason=null) { return { status, provider, version, reason, evidenceId: status==='operated'?canonicalSha256({provider,version}):null }; }
export class PolyglotIntelligencePlane {
  constructor({ commandProbe = defaultProbe, governor = null } = {}) { this.commandProbe=commandProbe; this.governor=governor; this.lifecycle='inactive'; this.runtime=null; this.capabilityPromise=null; this.closedAt=null; }
  async #matrix() {
    if (!this.capabilityPromise) this.capabilityPromise=(async()=>{ const [clangd,sourcekit]=await Promise.all([this.commandProbe('clangd'),this.commandProbe('sourcekit-lsp')]); return new LanguageCapabilityMatrix({languages:[
      {id:'javascript',extensions:['.js','.mjs','.cjs','.jsx'],parser:cap('operated','typescript-compiler','vendored'),lsp:cap('external-gate','typescript-language-server',null,'not-operated-on-runner'),graph:cap('operated','typescript-ast','vendored')},
      {id:'typescript',extensions:['.ts','.mts','.cts','.tsx'],parser:cap('operated','typescript-compiler','vendored'),lsp:cap('external-gate','typescript-language-server',null,'not-operated-on-runner'),graph:cap('operated','typescript-ast','vendored')},
      {id:'python',extensions:['.py'],parser:cap('degraded','lexical'),lsp:cap('external-gate','pyright-langserver',null,'not-operated-on-runner')},
      {id:'rust',extensions:['.rs'],parser:cap('external-gate','tree-sitter-rust'),lsp:cap('external-gate','rust-analyzer')},
      {id:'go',extensions:['.go'],parser:cap('external-gate','tree-sitter-go'),lsp:cap('external-gate','gopls')},
      {id:'java',extensions:['.java'],parser:cap('external-gate','tree-sitter-java'),lsp:cap('external-gate','jdtls')},
      {id:'c',extensions:['.c','.h'],parser:cap('external-gate','tree-sitter-c'),lsp:clangd.available?cap('operated','clangd',clangd.version):cap('external-gate','clangd',null,clangd.reason)},
      {id:'cpp',extensions:['.cc','.cpp','.cxx','.hpp'],parser:cap('external-gate','tree-sitter-cpp'),lsp:clangd.available?cap('operated','clangd',clangd.version):cap('external-gate','clangd',null,clangd.reason)},
      {id:'csharp',extensions:['.cs'],parser:cap('external-gate','tree-sitter-c-sharp'),lsp:cap('external-gate','omnisharp')},
      {id:'kotlin',extensions:['.kt','.kts'],parser:cap('external-gate','tree-sitter-kotlin'),lsp:cap('external-gate','kotlin-language-server')},
      {id:'swift',extensions:['.swift'],parser:cap('external-gate','tree-sitter-swift'),lsp:sourcekit.available?cap('operated','sourcekit-lsp',sourcekit.version):cap('external-gate','sourcekit-lsp',null,sourcekit.reason)},
      {id:'php',extensions:['.php'],parser:cap('external-gate','tree-sitter-php'),lsp:cap('external-gate','phpactor')},
      {id:'ruby',extensions:['.rb'],parser:cap('external-gate','tree-sitter-ruby'),lsp:cap('external-gate','ruby-lsp')},
    ]}); })();
    return this.capabilityPromise;
  }
  #ensure() { if(this.lifecycle==='closed') throw Object.assign(new Error('POLYGLOT_INTELLIGENCE_CLOSED'),{code:'POLYGLOT_INTELLIGENCE_CLOSED'}); if(!this.runtime){ this.runtime={sourceClassifier:new SourceClassifier(),frameworks:new FrameworkCapabilityRegistry(),fusion:new RelationshipGraphFusionService(),observations:new RuntimeObservationStore(),sentinel:new ArchitectureDriftSentinel()}; this.lifecycle='active'; } return this.runtime; }
  async status(){ const matrix=await this.#matrix(); const base={schema:'forge.polyglot-intelligence-plane-status.v1',lifecycle:this.lifecycle,closedAt:this.closedAt,languages:matrix.list(),pressureState:this.governor?.snapshot?.()?.state??null,ambiguityPreserved:true,productionParityClaimed:false}; return freeze({...base,receiptSha256:canonicalSha256(base)}); }
  classifySource(filePath, options={}) { return this.#ensure().sourceClassifier.classify(filePath,options); }
  probeFrameworks(input={}) { return this.#ensure().frameworks.probe(input); }
  fuse(input={}) { return this.#ensure().fusion.ingest(input); }
  observeRuntime(input={}) { const runtime=this.#ensure(); const row=runtime.observations.append(input); const projection=runtime.observations.graphProjection({projectId:row.projectId}); runtime.fusion.ingest({source:'runtime',edges:projection.edges.map((edge)=>({...edge,provenance:{path:'',line:0,sourceSha256:edge.provenance.receiptId,receiptId:edge.provenance.receiptId}}))}); return row; }
  graph() { return this.#ensure().fusion.snapshot(); }
  runtimeObservations(query={}) { return this.#ensure().observations.query(query); }
  evaluateDrift(input={}) { const sentinel=input.layerRules?new ArchitectureDriftSentinel({layerRules:input.layerRules,blockingSeverities:input.blockingSeverities,minimumBlockingConfidence:input.minimumBlockingConfidence}):this.#ensure().sentinel; return sentinel.evaluate(input); }
  async close(){ if(this.lifecycle==='closed') return this.status(); this.runtime?.observations.clear(); this.runtime=null; this.lifecycle='closed'; this.closedAt=new Date().toISOString(); return this.status(); }
}
