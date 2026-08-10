import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {compileExecutionGraph} from '../fabric/execution-graph.mjs';
import {compileReviewScope} from '../review/review-scope.mjs';
import {runCodeReviewBenchmark} from '../review/review-benchmark.mjs';
import {compileWorkUnitContexts} from '../context/work-unit-context.mjs';
import {compileHarnessProfile} from '../harness/profile-compiler.mjs';
import {compileCapabilityMatrix} from '../harness/capability-matrix.mjs';
import {scanAgentSurface} from '../security-surface/scanner.mjs';
import {runAgentSurfaceAdversarialCorpus} from '../security-surface/adversarial-corpus.mjs';
import {canonicalSha256} from '../core/canonical-json.mjs';
import {PRODUCT} from '../core/constants.mjs';

const loadJson=async(file)=>JSON.parse(await readFile(file,'utf8'));

export class V06RuntimeService{
  #root;#catalog=null;#kernel=null;#l1=null;#graph=null;
  constructor({root=process.cwd()}={}){this.#root=path.resolve(root);}
  async #state(){
    this.#catalog??=await loadJson(path.join(this.#root,'skills-v2/catalog.json'));
    this.#kernel??=await loadJson(path.join(this.#root,'skills-v2/kernel-index.json'));
    this.#l1??=await loadJson(path.join(this.#root,'skills-v2/l1-index.json'));
    this.#graph??=await loadJson(path.join(this.#root,'capabilities-v2/graph.json'));
    return{catalog:this.#catalog,kernel:this.#kernel,l1:this.#l1,graph:this.#graph};
  }
  async #manifest(skillId){
    const{catalog}=await this.#state();const entry=catalog.find(item=>item.id===skillId);
    if(!entry)throw new Error(`Unknown v0.6 technique: ${skillId}`);
    return loadJson(path.join(this.#root,entry.path,'manifest.json'));
  }
  async status(){
    const{kernel,l1,graph}=await this.#state();
    const reviewBenchmark=await runCodeReviewBenchmark();
    const agentSurfaceAdversarial=runAgentSurfaceAdversarialCorpus();
    const payload={version:PRODUCT.version,executionGraphVersion:2,kernelTechniqueCount:kernel.count+l1.count,l0TechniqueCount:kernel.count,l1TechniqueCount:l1.count,outcomeCount:graph.outcomes.length,techniqueCount:graph.techniques.length,evaluatorCount:graph.evaluators.length,reviewBenchmark,agentSurfaceAdversarial};
    return Object.freeze({...payload,statusSha256:canonicalSha256(payload)});
  }
  async compileExecutionGraph({skillId,workUnits,retryBudget=0}={}){
    const manifest=await this.#manifest(skillId);
    return compileExecutionGraph({technique:{id:manifest.id,version:manifest.version,executionProgram:manifest.executionProgram},workUnits,retryBudget});
  }
  compileReviewScope(args){return compileReviewScope(args);}
  compileWorkUnitContexts(args){return compileWorkUnitContexts(args);}
  compileHarnessProfile(args){return compileHarnessProfile(args);}
  compileHarnessCapabilityMatrix(args){return compileCapabilityMatrix(args);}
  scanAgentSurface(surface){return scanAgentSurface(surface);}
  runReviewBenchmark(){return runCodeReviewBenchmark();}
  runAgentSurfaceAdversarial(){return runAgentSurfaceAdversarialCorpus();}
}
