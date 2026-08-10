const FORBIDDEN=/project|prompt|content|token|secret|email|user_id|subject/i;
function metricName(value){const name=String(value);if(!/^[a-zA-Z_:][a-zA-Z0-9_:]*$/.test(name))throw new TypeError('Invalid metric name');return name;}
function labels(value={}){const result={};for(const [key,raw] of Object.entries(value)){if(FORBIDDEN.test(key))throw new TypeError(`Forbidden label: ${key}`);const text=String(raw);if(text.length>80)throw new TypeError(`Metric label ${key} is too long`);result[key]=text;}return result;}
function signature(name,labelSet){return `${name}\0${Object.entries(labelSet).sort().map(([k,v])=>`${k}=${v}`).join(',')}`;}
function formatLabels(value){const pairs=Object.entries(value);return pairs.length?`{${pairs.map(([k,v])=>`${k}=${JSON.stringify(v)}`).join(',')}}`:'';}
export class MetricsRegistry {
  constructor({service='forgeos',maxSeries=5000}={}){this.service=service;this.maxSeries=maxSeries;this.series=new Map();}
  #get(type,name,inputLabels){const cleanName=metricName(name);const cleanLabels=labels(inputLabels);const key=signature(cleanName,cleanLabels);let item=this.series.get(key);if(!item){if(this.series.size>=this.maxSeries)throw new Error('Metric series limit exceeded');item={type,name:cleanName,labels:cleanLabels,value:0};this.series.set(key,item);}if(item.type!==type)throw new Error('Metric type conflict');return item;}
  counter(name,inputLabels){const item=this.#get('counter',name,inputLabels);return {inc:(amount=1)=>{if(!Number.isFinite(amount)||amount<0)throw new TypeError('Counter increment must be non-negative');item.value+=amount;return item.value;}};}
  gauge(name,inputLabels){const item=this.#get('gauge',name,inputLabels);return {set:(value)=>{if(!Number.isFinite(value))throw new TypeError('Gauge value must be finite');item.value=value;return value;},inc:(amount=1)=>{item.value+=amount;return item.value;},dec:(amount=1)=>{item.value-=amount;return item.value;}};}
  renderPrometheus(){const lines=[];const named=new Set();for(const item of [...this.series.values()].sort((a,b)=>signature(a.name,a.labels).localeCompare(signature(b.name,b.labels)))){if(!named.has(item.name)){lines.push(`# TYPE ${item.name} ${item.type}`);named.add(item.name);}lines.push(`${item.name}${formatLabels(item.labels)} ${item.value}`);}return `${lines.join('\n')}\n`;}
}
