import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NolaneNativeOrchestrationService } from '../src/nolane-native/orchestration-service.mjs';
import { createRoutes } from '../src/server/routes.mjs';

class Backend { constructor(){this.url='about:blank';} async navigate(url){this.url=url;return{url};} async snapshot(){return{url:this.url,nodes:[{id:'go',role:'button',text:'Go'}]};} async act(action){return{target:action.target.id};} async screenshot(){return Buffer.from('shot');} async restart(){return{restarted:true};} }

async function fixture(t) {
  const root=await mkdtemp(path.join(os.tmpdir(),'nolane-wave11-production-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const service=new NolaneNativeOrchestrationService({dataDir:path.join(root,'.data'),workspaceRoot:root});await service.open();
  await service.attachNativeBrowserEngineWave11({backend:new Backend(),approval:async()=>({approved:true,approver:'test'})});
  service.createNativeBrowserProfile({id:'p1',allowedHosts:['example.com']});
  return service;
}

test('orchestration production-wires browser wave11',async(t)=>{const service=await fixture(t);await service.navigateNativeBrowserWave11({profileId:'p1',url:'https://example.com'});const clicked=await service.executeNativeBrowserWave11({profileId:'p1',type:'click',selector:{id:'go'}});assert.equal(clicked.effect.target,'go');assert.equal(service.status().browserWave11.attached,true);});

test('HTTP browser wave11 routes expose bounded journeys and status',async(t)=>{const service=await fixture(t);const route=createRoutes({nativeOrchestration:service});const call=async({method='GET',pathname,body=null})=>{let status;let data='';const req={method,forgePrincipal:{subject:'alice'},async *[Symbol.asyncIterator](){if(body!==null)yield Buffer.from(JSON.stringify(body));}};const res={writeHead(code){status=code;},end(chunk=''){data+=chunk;}};await route(req,res,new URL(`http://local${pathname}`));return{status,body:data?JSON.parse(data):null};};const journey=await call({method:'POST',pathname:'/api/nolane/native-core/browser/wave11/journey',body:{profileId:'p1',steps:[{type:'navigate',url:'https://example.com'},{type:'snapshot'},{type:'click',selector:{id:'go'}}]}});assert.equal(journey.status,200);assert.equal(journey.body.steps.length,3);const status=await call({pathname:'/api/nolane/native-core/browser/wave11/status'});assert.equal(status.body.attached,true);assert.equal(status.body.engine.profiles.length,1);});
