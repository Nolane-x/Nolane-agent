#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { validateProviderDogfoodCandidate } from './run-provider-dogfood-candidate.mjs';

export async function validateCandidateFile(filePath) {
  const target = path.resolve(String(filePath ?? '').trim());
  if (!target) throw new TypeError('candidate file path is required');
  const parsed = JSON.parse(await readFile(target, 'utf8'));
  return validateProviderDogfoodCandidate(parsed);
}

async function main() {
  try {
    const candidate = await validateCandidateFile(process.argv[2]);
    process.stdout.write(`${JSON.stringify({ valid: true, final_decision: candidate.final_decision, certification_state: candidate.certification_state })}\n`);
  } catch (error) {
    process.stderr.write(`${JSON.stringify({ valid: false, error: error?.code ?? 'DOGFOOD_CANDIDATE_INVALID' })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main();
