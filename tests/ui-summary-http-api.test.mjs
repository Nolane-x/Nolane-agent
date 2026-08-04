import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutes } from '../src/server/routes.mjs';

async function call(route, { method = 'GET', pathname, body = null }) { let status; let data=''; const req={method,async *[Symbol.asyncIterator](){if(body!==null)yield Buffer.from(JSON.stringify(body));}}; const res={writeHead(code){status=code;},end(chunk=''){data+=chunk;}}; await route(req,res,new URL(`http://local${pathname}`)); return {status,body:data?JSON.parse(data):null}; }

test('UI summary HTTP API returns snapshots and stops bounded processes', async () => {
  const calls=[]; const uiSummary={ snapshot:async({projectId})=>({projectId,processes:[{id:'x'}]}), stopProcess:async(id)=>{calls.push(id);return{id,state:'exited'};} };
  const route=createRoutes({uiSummary});
  assert.equal((await call(route,{pathname:'/api/ui/summary?projectId=p1'})).body.projectId,'p1');
  assert.equal((await call(route,{method:'POST',pathname:'/api/ui/summary/processes/x/stop'})).body.state,'exited');
  assert.deepEqual(calls,['x']);
});
