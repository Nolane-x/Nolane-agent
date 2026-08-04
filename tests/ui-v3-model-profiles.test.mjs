import test from 'node:test';
import assert from 'node:assert/strict';
import { renderModelProfilesPanel } from '../ui-v3/views/settings/model-profiles-panel.mjs';
import { createSettingsController } from '../ui-v3/views/settings/settings-controller.mjs';

test('model profile panel distinguishes unknown capabilities and exposes discovery and probes', async () => {
  const html=renderModelProfilesPanel({models:[{key:'p/m',providerId:'p',modelId:'m',displayName:'Model M',lifecycle:'unknown',capabilities:{tools:'unknown',vision:false,text:true},context:{inputTokens:1000},metadata:{}}],providers:[{id:'p',label:'Provider P',configured:true}]},{experience:'research'});
  assert.match(html,/Model M/); assert.match(html,/Unknown/); assert.match(html,/Discover models/); assert.match(html,/Probe/); assert.match(html,/Routing diagnostics/);
  const calls=[]; const api={get:async(path)=>path.includes('catalog')?{categories:[],experienceLevels:[]}:path.includes('effective')?{value:{experience:{level:'research'}}}:path.includes('provider-connections')?[]:{models:[]},put:async()=>({}),post:async(path,body)=>{calls.push([path,body]);return path.includes('discover')?{profiles:{models:[{key:'p/m'}]}}:{profile:{key:'p/m'}};}};
  const controller=createSettingsController({api}); await controller.load(); await controller.discoverModels('p'); await controller.probeModel('p','m',['text']);
  assert.deepEqual(calls.map((x)=>x[0]),['/api/model-profiles/discover','/api/model-profiles/probe']);
});
