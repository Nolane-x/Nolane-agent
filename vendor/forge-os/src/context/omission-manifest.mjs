import { canonicalSha256 } from '../core/canonical-json.mjs';

export function omissionEntry({sourceId,category,reason,estimatedTokens=0,retrieval=null,sourceHash=null}){
 if(!sourceId||!category||!reason)throw new TypeError('Omission requires sourceId, category, and reason');
 return Object.freeze({sourceId:String(sourceId),category:String(category),reason:String(reason),estimatedTokens:Number(estimatedTokens)||0,sourceHash:sourceHash??null,retrieval:retrieval??null});
}
export function finalizeOmissionManifest(entries){const normalized=[...entries].sort((a,b)=>a.category.localeCompare(b.category)||a.sourceId.localeCompare(b.sourceId));return Object.freeze({schemaVersion:1,entries:Object.freeze(normalized),sha256:canonicalSha256(normalized)});}
