import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { runFederationAdversarialCorpus } from '../src/evals/federation-adversarial.mjs';

const file=new URL('../evals/federation/adversarial-corpus.json',import.meta.url);
const cases=JSON.parse(await readFile(file,'utf8'));
const report=runFederationAdversarialCorpus(cases);
const output=process.env.FORGEOS_FEDERATION_EVAL_OUTPUT;
if(output){await mkdir(path.dirname(path.resolve(output)),{recursive:true});await writeFile(output,`${JSON.stringify(report,null,2)}\n`,{mode:0o600});}
if(report.summary.failed){
  console.error(JSON.stringify(report.failures,null,2));
  process.exitCode=1;
}else console.log(`Federation adversarial corpus: ${report.summary.passed}/${report.summary.total} passed (${report.corpusSha256}).`);
