import {canonicalSha256} from '../core/canonical-json.mjs';
const FEATURES=['skills','hooks','mcp','subagents','memory','approvals','sandbox'];
export function compileCapabilityMatrix({host,hostCapabilities={}}={}){const features={};for(const name of FEATURES){const supported=Boolean(hostCapabilities[name]);features[name]={status:supported?'supported':'unsupported',enforcement:supported?'host-native':'not-available'};}const payload={schemaVersion:1,host,features};return Object.freeze({...payload,matrixSha256:canonicalSha256(payload)});}
