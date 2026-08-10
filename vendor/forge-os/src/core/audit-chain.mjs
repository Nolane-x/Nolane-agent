import { canonicalSha256 } from './canonical-json.mjs';

function stateForDigest(project){
  const clone=structuredClone(project);
  delete clone.audit;
  return clone;
}

export function projectStateSha256(project){return canonicalSha256(stateForDigest(project));}

function eventHash(event){
  const value={...event};delete value.eventSha256;
  return canonicalSha256(value);
}

export function initializeAudit(project,{type='project-created',at=project.createdAt??new Date().toISOString(),metadata={}}={}){
  const event={sequence:1,type,revision:project.revision,semanticRevision:project.semanticRevision,stateSha256:projectStateSha256(project),prevSha256:null,metadata,at};
  event.eventSha256=eventHash(event);
  return {sequence:1,headSha256:event.eventSha256,events:[event]};
}

export function appendAuditEvent(project,{type='project-updated',at=project.updatedAt??new Date().toISOString(),metadata={}}={}){
  const previous=project.audit?.events?.at(-1)??null;
  const sequence=(project.audit?.sequence??0)+1;
  const event={sequence,type,revision:project.revision,semanticRevision:project.semanticRevision,stateSha256:projectStateSha256(project),prevSha256:previous?.eventSha256??null,metadata,at};
  event.eventSha256=eventHash(event);
  return {sequence,headSha256:event.eventSha256,events:[...(project.audit?.events??[]),event]};
}

export function validateAuditChain(project){
  const audit=project.audit;
  if(!audit||!Array.isArray(audit.events)||audit.events.length<1)throw new Error('Project audit hash chain is missing');
  let previous=null;
  for(let index=0;index<audit.events.length;index+=1){
    const event=audit.events[index];
    if(event.sequence!==index+1)throw new Error('Project audit sequence is invalid');
    if(event.prevSha256!==(previous?.eventSha256??null))throw new Error('Project audit hash chain is broken');
    if(event.eventSha256!==eventHash(event))throw new Error('Project audit event hash mismatch');
    previous=event;
  }
  if(audit.sequence!==audit.events.length||audit.headSha256!==previous.eventSha256)throw new Error('Project audit head is invalid');
  if(previous.revision!==project.revision||previous.semanticRevision!==project.semanticRevision)throw new Error('Project audit revision is stale');
  if(previous.stateSha256!==projectStateSha256(project))throw new Error('Project state digest does not match audit head');
  return project;
}
