import { mkdir, writeFile } from 'node:fs/promises';
import { RUNTIME_SCHEMAS } from '../src/core/runtime-schemas.mjs';
import { FEDERATION_SCHEMAS } from '../src/federation/schemas.mjs';
import { SKILL_INTELLIGENCE_SCHEMAS } from '../src/intelligence/schemas.mjs';
import { V06_SCHEMAS } from '../src/v06/schemas.mjs';
const files={project:'project.schema.json',artifact:'artifact.schema.json',evidence:'evidence.schema.json',gate:'gate-result.schema.json',skill:'skill-contract.schema.json',a2aAgentCard:'a2a-agent-card.schema.json',mcpToolResult:'mcp-tool-result.schema.json'};
const skillIntelligenceFiles={routePlan:'route-plan.schema.json',skillInspection:'skill-inspection.schema.json',skillContextPack:'skill-context-pack.schema.json',compiledContext:'compiled-context.schema.json',scope:'deterministic-scope.schema.json',evaluationManifest:'evaluation-manifest.schema.json',status:'skill-intelligence-status.schema.json'};
const v06Files={status:'v06-status.schema.json',executionGraph:'execution-graph.schema.json',reviewScope:'review-scope.schema.json',workUnitContexts:'work-unit-context.schema.json',harnessPlan:'harness-profile-plan.schema.json',securityReport:'agent-surface-scan.schema.json'};
const federationFiles={federationSource:'federation-source.schema.json',capability:'capability.schema.json',provider:'provider.schema.json',knowledgePack:'knowledge-pack.schema.json',executionBundle:'execution-bundle.schema.json',contextPack:'context-pack.schema.json',syncResult:'federation-sync-result.schema.json',mcpExecutionReceipt:'mcp-execution-receipt.schema.json',resolvedBundle:'resolved-bundle.schema.json'};
await mkdir('schemas',{recursive:true});
for(const [name,schema] of Object.entries(RUNTIME_SCHEMAS))await writeFile(`schemas/${files[name]}`,`${JSON.stringify(schema,null,2)}\n`);
for(const [name,schema] of Object.entries(FEDERATION_SCHEMAS))await writeFile(`schemas/${federationFiles[name]}`,`${JSON.stringify(schema,null,2)}\n`);
for(const [name,schema] of Object.entries(SKILL_INTELLIGENCE_SCHEMAS))await writeFile(`schemas/${skillIntelligenceFiles[name]}`,`${JSON.stringify(schema,null,2)}\n`);
for(const [name,schema] of Object.entries(V06_SCHEMAS)){if(!v06Files[name])continue;await writeFile(`schemas/${v06Files[name]}`,`${JSON.stringify(schema,null,2)}\n`);}
console.log(`Generated ${Object.keys(files).length+Object.keys(federationFiles).length+Object.keys(skillIntelligenceFiles).length+Object.keys(v06Files).length} runtime schemas.`);
