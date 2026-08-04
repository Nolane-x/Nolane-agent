const utf8Bytes=(value)=>Buffer.byteLength(String(value??''),'utf8');
const familyRules=[
 {id:'openai',pattern:/^(gpt|o[1-9]|chatgpt)/i,bytesPerToken:3.72,messageOverhead:4,toolOverhead:10},
 {id:'anthropic',pattern:/^(claude)/i,bytesPerToken:3.55,messageOverhead:5,toolOverhead:12},
 {id:'gemini',pattern:/^(gemini)/i,bytesPerToken:3.9,messageOverhead:4,toolOverhead:10},
 {id:'huggingface',pattern:/(qwen|llama|mistral|gemma|deepseek|phi|hf)/i,bytesPerToken:3.35,messageOverhead:5,toolOverhead:12},
 {id:'fallback',pattern:/.*/,bytesPerToken:3.1,messageOverhead:6,toolOverhead:14},
];
function stableJson(value){return JSON.stringify(value,Object.keys(value??{}).sort());}
class HeuristicProvider{
 constructor(rule,calibration){this.id=rule.id;this.modelPattern=rule.pattern;this.rule=rule;this.calibration=calibration;}
 factor(model,kind){return this.calibration.get(`${this.id}:${model}:${kind}`)??1;}
 countRaw(value,model,kind){return Math.max(1,Math.ceil((utf8Bytes(value)/this.rule.bytesPerToken)*this.factor(model,kind)));}
 async countText(text,{model='fallback'}={}){return this.countRaw(text,model,'text');}
 async countMessages(messages,{model='fallback'}={}){let total=2;for(const message of messages??[])total+=this.rule.messageOverhead+this.countRaw(typeof message.content==='string'?message.content:stableJson(message.content),model,'messages');return total;}
 async countToolSchemas(tools,{model='fallback'}={}){let total=0;for(const tool of tools??[])total+=this.rule.toolOverhead+this.countRaw(stableJson(tool),model,'tools');return total;}
 safetyMargin(observedError=0){return Math.max(0.08,Math.min(0.35,Math.abs(observedError)+0.05));}
}
export class TokenAccountingRegistry{
 constructor(rules=familyRules){this.calibration=new Map();this.providers=rules.map((rule)=>new HeuristicProvider(rule,this.calibration));this.observations=[];}
 providerFor(model){return this.providers.find((provider)=>provider.modelPattern.test(String(model)))??this.providers.at(-1);}
 async countText(model,text){return this.providerFor(model).countText(text,{model});}
 async countMessages(model,messages){return this.providerFor(model).countMessages(messages,{model});}
 async countToolSchemas(model,tools){return this.providerFor(model).countToolSchemas(tools,{model});}
 observe({model,estimatedTokens,actualTokens,contentClass='text'}){if(!Number.isFinite(estimatedTokens)||estimatedTokens<=0||!Number.isFinite(actualTokens)||actualTokens<=0)throw new TypeError('Valid token observation is required');const provider=this.providerFor(model);const key=`${provider.id}:${model}:${contentClass}`;const ratio=actualTokens/estimatedTokens;const previous=this.calibration.get(key)??1;const next=previous*0.65+ratio*0.35;this.calibration.set(key,Math.max(.6,Math.min(1.8,next)));const record=Object.freeze({model,providerId:provider.id,estimatedTokens,actualTokens,absoluteError:Math.abs(actualTokens-estimatedTokens),relativeError:Math.abs(actualTokens-estimatedTokens)/actualTokens,contentClass,observedAt:new Date().toISOString()});this.observations.push(record);return record;}
 snapshot(){return Object.freeze({calibration:Object.fromEntries(this.calibration),observations:[...this.observations]});}
}
export function createDefaultTokenAccountingRegistry(){return new TokenAccountingRegistry();}
