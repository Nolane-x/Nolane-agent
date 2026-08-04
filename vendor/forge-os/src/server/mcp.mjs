import { randomUUID } from 'node:crypto';
import { PRODUCT } from '../core/constants.mjs';
import { assertSafeValue } from '../core/security.mjs';
import { assertPrincipal } from '../core/principals.mjs';
import { TOOL_DEFINITIONS, TOOL_BY_NAME, callForgeTool } from './tool-registry.mjs';
import { SchemaValidationError, validateSchema } from '../core/schema-validator.mjs';
import { renderForgeStudioHtml } from '../ui/forge-studio.mjs';

export const WIDGET_URI = 'ui://forgeos/studio-v2.html';
const SUPPORTED_PROTOCOLS = Object.freeze([PRODUCT.protocolTargets.mcp]);
const LIST_PAGE_SIZE = 50;
const prompts = Object.freeze([
  { name:'forge_new_product',title:'Forge a new product',description:'Resolve intent, research the problem, generate mechanism-distinct concepts, and route the next verified action.',arguments:[{name:'goal',description:'What the user wants to create',required:true}] },
  { name:'forge_existing_idea',title:'Build an existing idea',description:'Start from a user-owned idea and produce product, UX, architecture, plan, and verification artifacts.',arguments:[{name:'idea',description:'The existing idea',required:true}] },
  { name:'forge_verify_product',title:'Verify a product',description:'Create a risk-proportional assurance plan and evidence dossier for an existing product.',arguments:[{name:'scope',description:'Product or repository scope',required:true}] },
]);

const response = (id, result) => ({ jsonrpc:'2.0', id, result });
const error = (id, code, message, data) => ({ jsonrpc:'2.0', id:id ?? null, error:{code,message,...(data===undefined?{}:{data})} });
const isNotification = (request) => request && request.jsonrpc === '2.0' && !Object.hasOwn(request, 'id');

function cursorPage(items, cursor) {
  const start = cursor ? Number.parseInt(Buffer.from(String(cursor), 'base64url').toString('utf8'), 10) : 0;
  if (!Number.isInteger(start) || start < 0 || start > items.length) throw new SchemaValidationError(['$.cursor is invalid'], 'cursor');
  const values = items.slice(start, start + LIST_PAGE_SIZE);
  const next = start + values.length < items.length ? Buffer.from(String(start + values.length), 'utf8').toString('base64url') : undefined;
  return { values, next };
}

function toolResult(data, text = 'ForgeOS operation completed.') {
  return { structuredContent:data, content:[{type:'text',text}], _meta:{ ui:{resourceUri:WIDGET_URI}, 'openai/outputTemplate':WIDGET_URI } };
}

function toolFailure(code, message, requestId, details) {
  return {
    isError:true,
    content:[{type:'text',text:message}],
    structuredContent:{error:{code,message,requestId,...(details ? { details } : {})}},
  };
}

export function createMcpSession({ id = randomUUID() } = {}) {
  return {
    id,
    phase: 'new',
    protocolVersion: null,
    clientInfo: null,
    clientCapabilities: {},
    createdAt: new Date().toISOString(),
    initializedAt: null,
    readyAt: null,
  };
}

function ensureSession(context) {
  if (!context.session) context.session = createMcpSession();
  return context.session;
}

function lifecycleError(request, session) {
  if (request.method === 'initialize' || request.method === 'ping') return null;
  if (session.phase === 'new') return error(request.id, -32002, 'Server session is not initialized', { code:'session_not_initialized' });
  if (session.phase === 'initialized' && request.method !== 'notifications/initialized') return error(request.id, -32002, 'Server session is not ready', { code:'session_not_ready' });
  return null;
}

function safeLog(context, event) {
  try { context.logger?.(event); } catch { /* logging must never change protocol behavior */ }
}

export async function handleMcpRpc(request, context = {}) {
  const notification = isNotification(request);
  const requestId = `req_${randomUUID().replaceAll('-', '')}`;
  const session = ensureSession(context);
  try {
    assertSafeValue(request);
    if (!request || request.jsonrpc !== '2.0' || typeof request.method !== 'string') return notification ? null : error(request?.id,-32600,'Invalid Request',{code:'invalid_request'});
    const lifecycle = lifecycleError(request, session);
    if (lifecycle) return notification ? null : lifecycle;
    const id = request.id;
    switch (request.method) {
      case 'initialize': {
        if (notification) return null;
        if (session.phase !== 'new') return error(id,-32600,'Session is already initialized',{code:'already_initialized'});
        const params = request.params ?? {};
        const requested = String(params.protocolVersion ?? '');
        if (!SUPPORTED_PROTOCOLS.includes(requested)) return error(id,-32602,'Unsupported protocol version',{code:'unsupported_protocol_version',supported:[...SUPPORTED_PROTOCOLS],requested});
        if (!params.clientInfo?.name || !params.clientInfo?.version || !params.capabilities || typeof params.capabilities !== 'object') {
          return error(id,-32602,'Invalid initialize parameters',{code:'invalid_initialize_params'});
        }
        session.phase = 'initialized';
        session.protocolVersion = requested;
        session.clientInfo = structuredClone(params.clientInfo);
        session.clientCapabilities = structuredClone(params.capabilities);
        session.initializedAt = new Date().toISOString();
        return response(id,{ protocolVersion:requested, capabilities:{tools:{listChanged:false},resources:{subscribe:false,listChanged:false},prompts:{listChanged:false}}, serverInfo:{name:'forge-os',title:'ForgeOS',version:PRODUCT.version,description:'Evidence-backed product engineering control plane for AI agents.'}, instructions:'Use ForgeOS to convert confirmed intent into typed, independently verified product artifacts. Material requirements require explicit user confirmation.' });
      }
      case 'notifications/initialized':
        if (session.phase === 'initialized') {
          session.phase = 'ready';
          session.readyAt = new Date().toISOString();
        }
        return null;
      case 'ping': return notification ? null : response(id,{});
      case 'tools/list': {
        const { values, next } = cursorPage(TOOL_DEFINITIONS, request.params?.cursor);
        const tools = values.map((item) => ({...item,_meta:{...item._meta,ui:{resourceUri:WIDGET_URI},'openai/outputTemplate':WIDGET_URI}}));
        return response(id,{tools,...(next?{nextCursor:next}:{})});
      }
      case 'tools/call': {
        const name=request.params?.name; const args=request.params?.arguments??{};
        try { assertPrincipal(context.principal); }
        catch { return response(id,toolFailure('authenticated_principal_required','An authenticated principal is required to call ForgeOS tools.',requestId)); }
        const definition = TOOL_BY_NAME.get(name);
        if (!definition) return response(id,toolFailure('unknown_tool','Unknown ForgeOS tool.',requestId));
        if (definition._meta?.['forgeos/humanOnly']) {
          try { assertPrincipal(context.principal, { type:'human' }); }
          catch { return response(id,toolFailure('human_principal_required','This action requires an authenticated human principal.',requestId)); }
        }
        const input = validateSchema(definition.inputSchema, args, { label:`arguments for ${name}`, throwOnError:false });
        if (!input.valid) return response(id,toolFailure('invalid_tool_arguments','Invalid arguments for this tool.',requestId,input.errors));
        try {
          const data=await callForgeTool(name,args,context.forge,{principal:context.principal,requestId,session,federation:context.federation,intelligence:context.intelligence,v06:context.v06,signal:context.signal});
          const output = validateSchema(definition.outputSchema, data, { label:`output from ${name}`, throwOnError:false });
          if (!output.valid) {
            safeLog(context,{level:'error',event:'invalid-tool-output',requestId,tool:name,errors:output.errors});
            return response(id,toolFailure('invalid_tool_output','The tool produced an invalid result.',requestId));
          }
          return response(id,toolResult(data,`${name} completed.`));
        } catch (cause) {
          safeLog(context,{level:'error',event:'tool-execution-error',requestId,tool:name,error:cause?.stack ?? String(cause)});
          return response(id,toolFailure('tool_execution_error','The ForgeOS operation could not be completed.',requestId));
        }
      }
      case 'resources/list': {
        const resources=[{uri:WIDGET_URI,name:'forgeos-studio',title:'ForgeOS Studio',description:'Interactive project, typed skill graph, artifact lineage, evidence, and risk console.',mimeType:'text/html;profile=mcp-app',icons:[]}];
        const { values, next }=cursorPage(resources,request.params?.cursor);
        return response(id,{resources:values,...(next?{nextCursor:next}:{})});
      }
      case 'resources/read': {
        if (request.params?.uri!==WIDGET_URI) return error(id,-32602,'Unknown resource',{code:'unknown_resource'});
        return response(id,{contents:[{uri:WIDGET_URI,mimeType:'text/html;profile=mcp-app',text:renderForgeStudioHtml(),_meta:{ui:{prefersBorder:false,csp:{connectDomains:[],resourceDomains:[],frameDomains:[]}}}}]});
      }
      case 'prompts/list': {
        const { values, next }=cursorPage(prompts,request.params?.cursor);
        return response(id,{prompts:values,...(next?{nextCursor:next}:{})});
      }
      case 'prompts/get': {
        const prompt=prompts.find((item)=>item.name===request.params?.name); if(!prompt)return error(id,-32602,'Unknown prompt',{code:'unknown_prompt'});
        const args=request.params?.arguments??{};
        const missing=prompt.arguments.filter((argument)=>argument.required&&!String(args[argument.name]??'').trim());
        if(missing.length)return error(id,-32602,'Missing required prompt argument',{code:'missing_prompt_argument',arguments:missing.map((item)=>item.name)});
        return response(id,{description:prompt.description,messages:[{role:'user',content:{type:'text',text:`Use ForgeOS. ${prompt.title}. Input: ${JSON.stringify(args)}`}}]});
      }
      default: return notification ? null : error(id,-32601,'Method not found',{code:'method_not_found'});
    }
  } catch (cause) {
    safeLog(context,{level:'error',event:'mcp-internal-error',requestId,error:cause?.stack ?? String(cause)});
    return notification ? null : error(request?.id,-32603,'Internal error',{code:'internal_error',requestId});
  }
}
