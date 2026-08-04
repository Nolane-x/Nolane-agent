import assert from 'node:assert/strict';
import test from 'node:test';
import { createRoutes } from '../src/server/routes.mjs';

async function call(route, { method = 'GET', pathname, body = null }) { let status; let data=''; const req={method,async *[Symbol.asyncIterator](){if(body!==null)yield Buffer.from(JSON.stringify(body));}}; const res={writeHead(code){status=code;},end(chunk=''){data+=chunk;}}; await route(req,res,new URL(`http://local${pathname}`)); return {status,body:data?JSON.parse(data):null}; }

test('onboarding HTTP API exposes status, progress, complete, recommended defaults and skip', async () => {
  const calls=[];
  const onboardingService={
    status:async()=>({schema:'status'}), saveProgress:async(body)=>{calls.push(['progress',body]);return{schema:'progress'};},
    complete:async(body)=>{calls.push(['complete',body]);return{schema:'complete'};}, recommended:async(body)=>{calls.push(['recommended',body]);return{schema:'recommended'};}, skip:async()=>({schema:'skip'})
  };
  const route=createRoutes({onboardingService});
  assert.equal((await call(route,{pathname:'/api/onboarding/status'})).body.schema,'status');
  assert.equal((await call(route,{method:'POST',pathname:'/api/onboarding/progress',body:{currentStep:1}})).body.schema,'progress');
  assert.equal((await call(route,{method:'POST',pathname:'/api/onboarding/complete',body:{answers:{language:'vi'}}})).body.schema,'complete');
  assert.equal((await call(route,{method:'POST',pathname:'/api/onboarding/recommended',body:{primaryUse:'software'}})).body.schema,'recommended');
  assert.equal((await call(route,{method:'POST',pathname:'/api/onboarding/skip',body:{}})).body.schema,'skip');
  assert.deepEqual(calls[0],['progress',{currentStep:1}]);
});
