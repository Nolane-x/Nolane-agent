import test from 'node:test';
import assert from 'node:assert/strict';
import { MetricsRegistry } from '../src/production/metrics.mjs';
import { RuntimeLifecycle } from '../src/production/runtime-lifecycle.mjs';

test('metrics expose bounded low-cardinality operational signals without project or secret labels',()=>{
  const metrics=new MetricsRegistry({service:'forgeos'});
  metrics.counter('forgeos_requests_total',{route:'mcp',status:'ok'}).inc();
  metrics.gauge('forgeos_federation_freshness_seconds',{source_kind:'mcp-registry'}).set(42);
  assert.throws(()=>metrics.counter('bad',{project_id:'forge_secret_project'}),/forbidden label/i);
  assert.throws(()=>metrics.counter('bad',{token:'secret'}),/forbidden label/i);
  const text=metrics.renderPrometheus();
  assert.match(text,/forgeos_requests_total/); assert.doesNotMatch(text,/forge_secret_project|secret/);
});

test('runtime readiness reflects repository and federation health and graceful shutdown drains in-flight work',async()=>{
  let repository=true; let federationFresh=true;
  const lifecycle=new RuntimeLifecycle({checks:{repository:async()=>repository,federation:async()=>federationFresh},shutdownTimeoutMs:100});
  lifecycle.markStarted();
  assert.equal((await lifecycle.status()).ready,true);
  federationFresh=false; const degraded=await lifecycle.status(); assert.equal(degraded.ready,true); assert.equal(degraded.degraded,true);
  repository=false; assert.equal((await lifecycle.status()).ready,false);
  repository=true; federationFresh=true;
  const release=lifecycle.beginRequest(); let closed=false;
  const closing=lifecycle.shutdown({close:async()=>{closed=true;}});
  await new Promise(r=>setTimeout(r,10)); assert.equal(closed,false);
  release(); await closing; assert.equal(closed,true); assert.equal(lifecycle.state,'stopped');
  assert.throws(()=>lifecycle.beginRequest(),/draining|stopped/i);
});
