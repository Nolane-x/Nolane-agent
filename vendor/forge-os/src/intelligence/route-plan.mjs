import { canonicalSha256 } from '../core/canonical-json.mjs';
function deepFreeze(value){if(value&&typeof value==='object'&&!Object.isFrozen(value)){for(const child of Object.values(value))deepFreeze(child);Object.freeze(value);}return value;}
export function freezeRoutePlan(payload){const stable=structuredClone(payload);delete stable.routePlanId;delete stable.routePlanSha256;delete stable.generatedAt;const routePlanSha256=canonicalSha256(stable);return deepFreeze({...stable,routePlanId:`route_${routePlanSha256.slice(0,24)}`,routePlanSha256,generatedAt:null});}
