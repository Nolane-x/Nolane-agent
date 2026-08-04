import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const VERIFIED_ITEMS = Object.freeze(['1.2','1.3','1.4','1.14','1.18','1.23','2.3','2.10','2.14','2.15','2.16','2.18','2.19','2.20','2.29','4.3','7.22','21.11','21.12','21.14']);
const REQUIRED = Object.freeze([
  'src/orchestration/architecture-stage-gate.mjs','src/orchestration/mission-completion-orchestrator.mjs','src/orchestration/mission-runner.mjs','src/sandbox/local-container-preflight-service.mjs','src/app.mjs','src/server/routes.mjs',
  'tests/architecture-stage-gate.test.mjs','tests/mission-completion-orchestrator.test.mjs','tests/local-container-preflight-service.test.mjs','tests/runtime-readiness-app-wiring.test.mjs','tests/runtime-readiness-http-api.test.mjs','tests/mission-completion-runtime-readiness-release-gate.test.mjs','scripts/audit-feature-checklist.mjs','src/release/full-release-matrix.mjs'
]);
const item = (audit,id)=>audit?.sections?.flatMap(s=>s.items??[]).find(i=>i.id===id);
async function source(root,rel,failures){try{return await readFile(path.join(root,rel),'utf8');}catch{failures.push(`missing required source: ${rel}`);return '';}}
function requirePattern(text,re,label,failures){if(!re.test(text))failures.push(`missing ${label}`);}
export async function verifyMissionCompletionRuntimeReadiness({rootDirectory=process.cwd(),version,outputFile}={}){
  const root=path.resolve(rootDirectory); const releaseVersion=String(version??'').trim(); const failures=[]; const contents=new Map();
  for(const rel of REQUIRED) contents.set(rel,await source(root,rel,failures));
  const stage=contents.get('src/orchestration/architecture-stage-gate.mjs')??'';
  const workflow=contents.get('src/orchestration/mission-completion-orchestrator.mjs')??'';
  const runner=contents.get('src/orchestration/mission-runner.mjs')??'';
  const container=contents.get('src/sandbox/local-container-preflight-service.mjs')??'';
  const routes=contents.get('src/server/routes.mjs')??'';
  const auditSource=contents.get('scripts/audit-feature-checklist.mjs')??'';
  const matrix=contents.get('src/release/full-release-matrix.mjs')??'';
  requirePattern(stage,/(?=[\s\S]*core)(?=[\s\S]*ide)(?=[\s\S]*desktop)(?=[\s\S]*cloud)(?=[\s\S]*cloudOperational:\s*false)(?=[\s\S]*reasoningExecutionSeparated)(?=[\s\S]*receiptSha256)/,'ordered architecture stages and non-operational cloud claim',failures);
  requirePattern(stage,/(?=[\s\S]*executionClass)(?=[\s\S]*mutationAllowed)(?=[\s\S]*maxTurns)(?=[\s\S]*maxToolCalls)(?=[\s\S]*maxEstimatedTokens)(?=[\s\S]*maxElapsedMs)/,'task resource and reasoning/execution envelope',failures);
  requirePattern(runner,/(?=[\s\S]*buildTaskGovernanceEnvelope)(?=[\s\S]*resourceLimits)(?=[\s\S]*governanceEnvelope)(?=[\s\S]*agentLoop\.run)/,'MissionRunner governance envelope wiring',failures);
  requirePattern(workflow,/(?=[\s\S]*repair-tests)(?=[\s\S]*repair-dependencies)(?=[\s\S]*resolve-conflicts)(?=[\s\S]*security-review)(?=[\s\S]*update-docs)(?=[\s\S]*local-pr-review)(?=[\s\S]*git\.commit)(?=[\s\S]*parallelGroups)/,'end-to-end mission completion workflow',failures);
  requirePattern(container,/(?=[\s\S]*docker)(?=[\s\S]*info)(?=[\s\S]*shell:\s*false)(?=[\s\S]*SOCKET_PATTERNS)(?=[\s\S]*CREDENTIAL_PATTERNS)(?=[\s\S]*containerCreated:\s*false)/,'Docker daemon mount and socket preflight',failures);
  requirePattern(routes,/(?=[\s\S]*\/api\/runtime-readiness\/architecture)(?=[\s\S]*\/api\/runtime-readiness\/missions)(?=[\s\S]*\/api\/runtime-readiness\/container)(?=[\s\S]*req\.forgePrincipal\?\.subject)(?=[\s\S]*Mount source must be a project-relative path)/,'authenticated bounded runtime readiness API',failures);
  requirePattern(auditSource,/missionCompletionRuntimeReadiness[\s\S]*Sửa test thất bại[\s\S]*Kiểm tra socket escape/,'item-level audit evidence',failures);
  requirePattern(matrix,/id:\s*'mission-completion-runtime-readiness'[\s\S]*verify-mission-completion-runtime-readiness\.mjs/,'required Full Release Matrix gate',failures);
  let audit=null; try{audit=JSON.parse(await readFile(path.join(root,'docs',`feature-audit-${releaseVersion}.json`),'utf8'));}catch{failures.push(`missing or invalid feature audit for ${releaseVersion}`);}
  for(const id of VERIFIED_ITEMS) if(item(audit,id)?.status!=='verified_source_test') failures.push(`feature audit item ${id} is not verified_source_test`);
  const limitations=await source(root,`docs/LIMITATIONS-${releaseVersion}.md`,failures);
  const boundaries={cloudOperationalClaimed:!/cloud.*eligib|không.*cloud.*operat|không.*vận hành.*cloud/i.test(limitations),remotePrClaimed:!/local PR review|review.*local|không.*tạo PR.*remote/i.test(limitations),containerCreatedClaimed:!/preflight.*không.*tạo container|does not create.*container/i.test(limitations),platformCertifiedClaimed:!/source evidence.*(?:not|không).*(?:platform )?(?:certif|chứng nhận)|(?:not|không).*certif.*platform/i.test(limitations)};
  for(const [name,claimed] of Object.entries(boundaries)) if(claimed) failures.push(`unsupported claim remains: ${name}`);
  const digests={}; for(const [rel,text] of contents) if(text) digests[rel]=canonicalSha256({rel,text});
  const base=Object.freeze({schema:'forge.studio.mission-completion-runtime-readiness-verification.v1',version:releaseVersion,status:failures.length?'fail':'pass',verifiedItems:VERIFIED_ITEMS,boundaries:Object.freeze(boundaries),failures:Object.freeze(failures),fileDigests:Object.freeze(digests)});
  const report=Object.freeze({...base,receiptSha256:canonicalSha256(base)});
  if(outputFile){const target=path.resolve(outputFile);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,`${JSON.stringify(report,null,2)}\n`);}
  if(failures.length){const error=new Error(`Mission completion runtime readiness verification failed: ${failures.join('; ')}`);error.code='MISSION_COMPLETION_RUNTIME_READINESS_VERIFICATION_FAILED';error.report=report;throw error;}
  return report;
}
