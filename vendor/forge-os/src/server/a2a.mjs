import { randomUUID } from 'node:crypto';
import { PRODUCT } from '../core/constants.mjs';
import { assertPrincipal } from '../core/principals.mjs';
import { validateSchema } from '../core/schema-validator.mjs';
import { validateRuntimeSchema } from '../core/runtime-schemas.mjs';
import { MemoryA2aTaskStore } from './a2a-task-store.mjs';

const terminalStates=new Set(['TASK_STATE_COMPLETED','TASK_STATE_FAILED','TASK_STATE_CANCELED','TASK_STATE_REJECTED']);
const now=()=>new Date().toISOString();
const uid=(prefix)=>`${prefix}_${randomUUID().replaceAll('-','')}`;
const rpcError=(id,code,message,data)=>({jsonrpc:'2.0',id:id??null,error:{code,message,...(data?{data}:{})}});
const rpcResult=(id,result)=>({jsonrpc:'2.0',id,result});
const isNotification=(request)=>request&&request.jsonrpc==='2.0'&&!Object.hasOwn(request,'id');

const partSchema={oneOf:[
  {type:'object',properties:{text:{type:'string',minLength:1,maxLength:1_000_000},metadata:{type:'object',additionalProperties:true},mediaType:{type:'string'},filename:{type:'string'}},required:['text'],additionalProperties:false},
  {type:'object',properties:{data:{},metadata:{type:'object',additionalProperties:true},mediaType:{type:'string'},filename:{type:'string'}},required:['data'],additionalProperties:false},
  {type:'object',properties:{raw:{type:'string',minLength:1},metadata:{type:'object',additionalProperties:true},mediaType:{type:'string'},filename:{type:'string'}},required:['raw'],additionalProperties:false},
  {type:'object',properties:{url:{type:'string',format:'uri'},metadata:{type:'object',additionalProperties:true},mediaType:{type:'string'},filename:{type:'string'}},required:['url'],additionalProperties:false},
]};
const messageSchema={type:'object',properties:{messageId:{type:'string',minLength:1,maxLength:200},contextId:{type:'string',maxLength:200},taskId:{type:'string',maxLength:200},role:{enum:['ROLE_USER','ROLE_AGENT']},parts:{type:'array',items:partSchema,minItems:1,maxItems:200},metadata:{type:'object',additionalProperties:true},extensions:{type:'array',items:{type:'string',format:'uri'},maxItems:100},referenceTaskIds:{type:'array',items:{type:'string'},maxItems:100}},required:['messageId','role','parts'],additionalProperties:false};
const requestSchemas=Object.freeze({
  SendMessage:{type:'object',properties:{tenant:{type:'string'},message:messageSchema,configuration:{type:'object',additionalProperties:true},metadata:{type:'object',additionalProperties:true}},required:['message'],additionalProperties:false},
  GetTask:{type:'object',properties:{tenant:{type:'string'},id:{type:'string',minLength:1},historyLength:{type:'integer',minimum:0,maximum:1000}},required:['id'],additionalProperties:false},
  ListTasks:{type:'object',properties:{tenant:{type:'string'},contextId:{type:'string'},status:{type:'string'},pageSize:{type:'integer',minimum:1,maximum:100},pageToken:{type:'string'}},additionalProperties:false},
  CancelTask:{type:'object',properties:{tenant:{type:'string'},id:{type:'string',minLength:1},metadata:{type:'object',additionalProperties:true}},required:['id'],additionalProperties:false},
  GetExtendedAgentCard:{type:'object',properties:{tenant:{type:'string'}},additionalProperties:false},
});

export function agentCard(baseUrl) {
  const base=String(baseUrl).replace(/\/$/,'');
  const card = {
    name:'ForgeOS',
    description:'Evidence-backed product engineering, typed skill routing, novelty exploration, and release assurance for interoperable AI agents.',
    supportedInterfaces:[{url:`${base}/a2a`,protocolBinding:'JSONRPC',protocolVersion:PRODUCT.protocolTargets.a2a}],
    provider:{organization:'ForgeOS Contributors',url:'https://github.com/forgeos/forge-os'},
    version:PRODUCT.version,
    documentationUrl:`${base}/docs`,
    capabilities:{streaming:false,pushNotifications:false,extendedAgentCard:true},
    securitySchemes:{bearerAuth:{httpAuthSecurityScheme:{scheme:'bearer',bearerFormat:'opaque'}}},
    securityRequirements:[{schemes:{bearerAuth:{list:[]}}}],
    defaultInputModes:['text/plain','application/json'],
    defaultOutputModes:['application/json','text/plain'],
    skills:[
      {id:'forge-product',name:'Forge a product',description:'Turn confirmed intent into a revisioned project, ideas, typed artifacts, and an executable graph plan.',tags:['product','ideas','planning'],examples:['Create a SaaS project from a confirmed brief.']},
      {id:'forge-verify',name:'Verify a product',description:'Run assurance-aware gates backed by subject-bound evidence and independent findings.',tags:['testing','security','quality']},
      {id:'forge-route',name:'Route skills',description:'Plan a typed path from current artifacts and risks toward the next gate.',tags:['skills','routing','agents']},
      {id:'forge-interop',name:'Bridge agents',description:'Exchange project operations and typed artifacts with MCP, A2A, and Agent Skills clients.',tags:['mcp','a2a','interoperability']},
      {id:'forge-novelty',name:'Explore novel concepts',description:'Generate mechanism-distinct concepts, score exact idea coverage, and detect deterministic mechanism overlap.',tags:['creativity','research','innovation']},
    ],
  };
  validateRuntimeSchema('a2aAgentCard', card);
  return card;
}

function publicTask(record,{historyLength=null}={}) {
  const {ownerPrincipalId,revision,statusHistory,...task}=record;
  const result={...task,statusHistory:structuredClone(statusHistory)};
  if(historyLength!==null) result.history=historyLength===0?[]:(task.history??[]).slice(-historyLength);
  return result;
}

function replyMessage(taskId,contextId,text,data=null) {
  const parts=[{text,mediaType:'text/plain'}];
  if(data!==null)parts.push({data,mediaType:'application/json'});
  return {messageId:uid('message'),taskId,contextId,role:'ROLE_AGENT',parts,extensions:[]};
}

function actionPart(message) {
  return message.parts.find((part)=>part.data&&typeof part.data==='object'&&!Array.isArray(part.data)&&typeof part.data.action==='string')?.data??null;
}

async function executeAction(action,forge,principal) {
  const input=action.input??{};
  switch(action.action){
    case 'project.create': return {project:await forge.createProject(input,{principal})};
    case 'project.get': return {project:await forge.getProject(input.projectId,{principal})};
    case 'project.nextAction': await forge.assertProjectAccess(input.projectId,principal,'write'); return await forge.nextAction(input.projectId,{tools:input.tools??[],activeSkills:input.activeSkills??[],skillChannel:input.skillChannel??'candidate',principal});
    case 'project.gate.run': await forge.assertProjectAccess(input.projectId,principal,'write'); return {projectId:input.projectId,gate:await forge.runCurrentGate(input.projectId,{principal})};
    case 'skill.route': await forge.assertProjectAccess(input.projectId,principal,'write'); return {projectId:input.projectId,routes:await forge.routeNextSkills(input.projectId,{...input,principal})};
    case 'task.defer': return {deferred:true,reason:String(input.reason??'External execution requested')};
    default: throw new TypeError(`Unsupported ForgeOS A2A action: ${action.action}`);
  }
}

function storeFor(context){context.taskStore??=new MemoryA2aTaskStore();return context.taskStore;}
function validateParams(method,params){const result=validateSchema(requestSchemas[method],params??{},{throwOnError:false});if(!result.valid)throw Object.assign(new TypeError('Invalid A2A parameters'),{validationErrors:result.errors});}
async function ownedTask(store,id,principal){const task=await store.read(id);if(task.ownerPrincipalId!==principal.id)throw Object.assign(new Error('Task not found'),{code:'TASK_NOT_FOUND'});return task;}

export async function handleA2aRpc(request,context={}) {
  const notification=isNotification(request);
  try{
    if(!request||request.jsonrpc!=='2.0'||typeof request.method!=='string')return notification?null:rpcError(request?.id,-32600,'Invalid Request');
    const schema=requestSchemas[request.method];
    if(!schema)return notification?null:rpcError(request.id,-32601,'Method not found');
    const principal=assertPrincipal(context.principal);
    try{validateParams(request.method,request.params);}catch(cause){return notification?null:rpcError(request.id,-32602,'Invalid params',{errors:cause.validationErrors??[]});}
    const store=storeFor(context);
    if(request.method==='GetExtendedAgentCard')return notification?null:rpcResult(request.id,agentCard(context.baseUrl??'http://127.0.0.1:8787'));
    if(request.method==='SendMessage'){
      const message=structuredClone(request.params.message);
      if(message.role!=='ROLE_USER')return notification?null:rpcError(request.id,-32602,'Client messages must use ROLE_USER');
      const action=actionPart(message);
      const taskId=message.taskId??uid('task');
      const contextId=message.contextId??uid('context');
      const createdAt=now();
      let task;
      if(message.taskId){
        task=await ownedTask(store,message.taskId,principal);
        if(terminalStates.has(task.status.state))return notification?null:rpcError(request.id,-32002,'Task is in a terminal state');
        task=await store.update(task.id,(current)=>({...current,history:[...(current.history??[]),message],lastModified:now()}));
      }else{
        task=await store.create({id:taskId,contextId,ownerPrincipalId:principal.id,status:{state:'TASK_STATE_SUBMITTED',timestamp:createdAt},statusHistory:[{state:'TASK_STATE_SUBMITTED',timestamp:createdAt}],artifacts:[],history:[message],createdAt,lastModified:createdAt,metadata:{}});
      }
      if(!action){
        const reply=replyMessage(task.id,task.contextId,'ForgeOS requires a structured data part with an explicit action; no material intent was inferred.');
        task=await store.update(task.id,(current)=>({...current,status:{state:'TASK_STATE_INPUT_REQUIRED',message:reply,timestamp:now()},statusHistory:[...current.statusHistory,{state:'TASK_STATE_INPUT_REQUIRED',timestamp:now()}],history:[...current.history,reply],lastModified:now()}));
        return notification?null:rpcResult(request.id,{task:publicTask(task)});
      }
      if(action.action==='task.defer'){
        const data=await executeAction(action,context.forge,principal);
        const reply=replyMessage(task.id,task.contextId,'Task was accepted for external execution.',data);
        task=await store.update(task.id,(current)=>({...current,status:{state:'TASK_STATE_SUBMITTED',message:reply,timestamp:now()},history:[...current.history,reply],lastModified:now(),metadata:{...current.metadata,deferred:true}}));
        return notification?null:rpcResult(request.id,{task:publicTask(task)});
      }
      try{
        task=await store.update(task.id,(current)=>({...current,status:{state:'TASK_STATE_WORKING',timestamp:now()},statusHistory:[...current.statusHistory,{state:'TASK_STATE_WORKING',timestamp:now()}],lastModified:now()}));
        const data=await executeAction(action,context.forge,principal);
        const artifact={artifactId:uid('artifact'),name:'ForgeOS operation result',description:`Result of ${action.action}`,parts:[{data,mediaType:'application/json'}],extensions:[]};
        const reply=replyMessage(task.id,task.contextId,'ForgeOS completed the requested operation.',data);
        task=await store.update(task.id,(current)=>({...current,status:{state:'TASK_STATE_COMPLETED',message:reply,timestamp:now()},statusHistory:[...current.statusHistory,{state:'TASK_STATE_COMPLETED',timestamp:now()}],artifacts:[...current.artifacts,artifact],history:[...current.history,reply],lastModified:now(),metadata:{...current.metadata,action:action.action}}));
        return notification?null:rpcResult(request.id,{task:publicTask(task)});
      }catch(cause){
        const reply=replyMessage(task.id,task.contextId,'ForgeOS could not complete the requested operation.');
        task=await store.update(task.id,(current)=>({...current,status:{state:'TASK_STATE_FAILED',message:reply,timestamp:now()},statusHistory:[...current.statusHistory,{state:'TASK_STATE_FAILED',timestamp:now()}],history:[...current.history,reply],lastModified:now()}));
        try{context.logger?.({level:'error',event:'a2a-action-failed',requestId:context.requestId,taskId:task.id,error:cause?.stack??String(cause)});}catch{}
        return notification?null:rpcResult(request.id,{task:publicTask(task)});
      }
    }
    if(request.method==='GetTask'){
      try{const task=await ownedTask(store,request.params.id,principal);return notification?null:rpcResult(request.id,publicTask(task,{historyLength:request.params.historyLength??null}));}
      catch{return notification?null:rpcError(request.id,-32001,'Task not found');}
    }
    if(request.method==='ListTasks'){
      const all=(await store.list()).filter((task)=>task.ownerPrincipalId===principal.id).filter((task)=>!request.params.contextId||task.contextId===request.params.contextId).filter((task)=>!request.params.status||task.status.state===request.params.status).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
      const offset=request.params.pageToken?Number.parseInt(Buffer.from(request.params.pageToken,'base64url').toString('utf8'),10):0;
      if(!Number.isInteger(offset)||offset<0)return notification?null:rpcError(request.id,-32602,'Invalid page token');
      const size=request.params.pageSize??50;const page=all.slice(offset,offset+size).map((task)=>publicTask(task,{historyLength:0}));
      const next=offset+page.length<all.length?Buffer.from(String(offset+page.length)).toString('base64url'):undefined;
      return notification?null:rpcResult(request.id,{tasks:page,...(next?{nextPageToken:next}:{})});
    }
    if(request.method==='CancelTask'){
      let task;try{task=await ownedTask(store,request.params.id,principal);}catch{return notification?null:rpcError(request.id,-32001,'Task not found');}
      if(terminalStates.has(task.status.state))return notification?null:rpcError(request.id,-32002,'Task cannot be canceled from its current state');
      const reply=replyMessage(task.id,task.contextId,'Task was canceled by its owner.');
      task=await store.update(task.id,(current)=>({...current,status:{state:'TASK_STATE_CANCELED',message:reply,timestamp:now()},statusHistory:[...current.statusHistory,{state:'TASK_STATE_CANCELED',timestamp:now()}],history:[...current.history,reply],lastModified:now(),metadata:{...current.metadata,lease:null,canceledBy:principal.id}}));
      return notification?null:rpcResult(request.id,publicTask(task));
    }
    return notification?null:rpcError(request.id,-32601,'Method not found');
  }catch(cause){
    try{context.logger?.({level:'error',event:'a2a-internal-error',requestId:context.requestId,error:cause?.stack??String(cause)});}catch{}
    return notification?null:rpcError(request?.id,-32603,'Internal error',{requestId:context.requestId??uid('request')});
  }
}
