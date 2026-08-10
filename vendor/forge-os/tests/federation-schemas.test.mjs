import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import { FEDERATION_SCHEMAS } from '../src/federation/schemas.mjs';import { validateSchema } from '../src/core/schema-validator.mjs';import { loadCapabilityCatalog } from '../src/federation/capability-catalog.mjs';import { loadKnowledgePacks } from '../src/federation/knowledge-packs.mjs';
test('federation public schemas are draft 2020-12, strict, and validate generated capability and knowledge records',async()=>{for(const schema of Object.values(FEDERATION_SCHEMAS)){assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');assert.match(schema.$id,/forgeos\.dev\/schemas\/v0\.4/);}const capability=(await loadCapabilityCatalog())[0];assert.equal(validateSchema(FEDERATION_SCHEMAS.capability,capability,{throwOnError:false}).valid,true);const pack=(await loadKnowledgePacks())[0];assert.equal(validateSchema(FEDERATION_SCHEMAS.knowledgePack,pack,{throwOnError:false}).valid,true);});
test('generated federation schema files exist and reject additional capability properties',async()=>{for(const name of ['federation-source','capability','provider','knowledge-pack','execution-bundle','context-pack','federation-sync-result','mcp-execution-receipt','resolved-bundle'])assert.doesNotReject(()=>readFile(`schemas/${name}.schema.json`,'utf8'));const capability=structuredClone((await loadCapabilityCatalog())[0]);capability.unexpected=true;assert.equal(validateSchema(FEDERATION_SCHEMAS.capability,capability,{throwOnError:false}).valid,false);});

test('provider and resolved bundle schemas reject undeclared top-level fields',async()=>{
  const {loadBuiltInProviders}=await import('../src/federation/local-provider-seed.mjs');
  const provider=structuredClone((await loadBuiltInProviders())[0]);
  assert.equal(validateSchema(FEDERATION_SCHEMAS.provider,provider,{throwOnError:false}).valid,true);
  provider.unexpected=true;
  assert.equal(validateSchema(FEDERATION_SCHEMAS.provider,provider,{throwOnError:false}).valid,false);
  assert.equal(FEDERATION_SCHEMAS.provider.additionalProperties,false);
  assert.equal(FEDERATION_SCHEMAS.resolvedBundle.additionalProperties,false);
});
