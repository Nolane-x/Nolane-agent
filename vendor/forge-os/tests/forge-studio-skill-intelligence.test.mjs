import test from 'node:test';
import assert from 'node:assert/strict';
import { renderForgeStudioHtml } from '../src/ui/forge-studio.mjs';

test('Forge Studio v3 foundation renders Skill Intelligence metrics and uses public MCP tools',()=>{
 const html=renderForgeStudioHtml({project:{id:'p',name:'P',stage:'intent',assurance:'A1',domain:'ai-agent-engineering',revision:1,semanticRevision:1,ideas:[],artifacts:[],evidence:[],gates:[],findings:[],risks:[],routes:[]},skillIntelligence:{outcomeCount:1024,techniqueCount:128,l0TechniqueCount:32,evaluatorCount:128,stableProceduralProviders:33,candidateProceduralProviders:234},v06:{version:'0.6.0',kernelTechniqueCount:128,l0TechniqueCount:32,l1TechniqueCount:96,executionGraphVersion:2,reviewBenchmark:{cases:12,precision:1},agentSurfaceAdversarial:{cases:20,passed:20}}});
 assert.match(html,/Skill Intelligence/);
 assert.match(html,/128/);
 assert.match(html,/32 L0/);
 assert.match(html,/forge_intelligence_status/);
 assert.match(html,/forge_intelligence_route/);
 assert.match(html,/RoutePlan/);
 assert.match(html,/Context budget/);
 assert.match(html,/Deterministic Skill Fabric/);
 assert.match(html,/96 L1/);
 assert.match(html,/forge_v06_status/);
 assert.match(html,/forge_agent_surface_scan/);
 assert.match(html,/selected and excluded/i);
 assert.doesNotMatch(html,/complete visual graph editor/i);
});
