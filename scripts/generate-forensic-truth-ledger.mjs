#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { stableForensicId } from '../src/forensics/stable-id.mjs';
import { summarizeTruthLedger, validateTruthLedgerRecord } from '../src/forensics/truth-ledger.mjs';

const root = process.cwd();
const provisionalPath = path.join(root, 'requirements', 'nolane-native-provisional-source-inventory.jsonl');
const nolaneInventoryPath = path.join(root, 'requirements', 'nolane-symbol-surface-inventory.jsonl');
const outputPath = path.join(root, 'requirements', 'nolane-native-function-parity-ledger.jsonl');
const summaryPath = path.join(root, 'requirements', 'nolane-native-function-parity-summary.json');
const provisional = (await readFile(provisionalPath, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const nolaneRecords = (await readFile(nolaneInventoryPath, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const filesByPath = new Map(nolaneRecords.filter((record) => record.recordType === 'file').map((record) => [record.relativePath, record]));
const records = provisional.map((upstream) => {
  const candidate = upstream.historicalTarget ? filesByPath.get(upstream.historicalTarget) : null;
  return validateTruthLedgerRecord({
    id: stableForensicId('mapping', upstream.id),
    upstreamId: upstream.id,
    upstreamPath: upstream.sourcePath,
    upstreamSourceAvailability: upstream.sourceAvailability,
    upstreamSymbolId: null,
    nolaneSymbolIds: [],
    candidateNolaneFileIds: candidate ? [candidate.id] : [],
    historicalTarget: upstream.historicalTarget,
    status: upstream.state,
    productionWiring: [],
    positiveAssertions: [],
    negativeAssertions: [],
    failureBranches: 0,
    compatibilityEvidence: [],
    exclusion: upstream.state === 'excluded-with-reason' ? { category: 'historical-nonproduct-exclusion', reason: upstream.exclusionReason } : null,
    blocker: upstream.parityBlocker,
  });
}).sort((a, b) => a.id.localeCompare(b.id));
const jsonl = records.map((record) => JSON.stringify(record)).join('\n') + '\n';
await writeFile(outputPath, jsonl);
const summary = { ...summarizeTruthLedger(records), ledgerSha256: createHash('sha256').update(jsonl).digest('hex'), explicitNonClaim: 'Path-level historical entries remain unresolved until canonical NolaneNative symbols and behavioral evidence are available.' };
await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify(summary, null, 2));
