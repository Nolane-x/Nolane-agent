#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const mode = String(process.argv[2] ?? 'all');
const catalog = JSON.parse(await readFile('requirements/nolane-native-core-contracts.json', 'utf8'));
const conformance = JSON.parse(await readFile('requirements/nolane-native-core-conformance.json', 'utf8'));
const decomposition = JSON.parse(await readFile('requirements/nolane-native-core-decomposition.json', 'utf8'));
const entitlement = JSON.parse(await readFile('requirements/nolane-entitlement-policy.json', 'utf8'));
const fail = (message) => { throw new Error(message); };

const checks = {
  'no-residual'() {
    const residual = catalog.contracts.filter((contract) => contract.id.includes('RESIDUAL'));
    if (residual.length) fail(`Residual contracts remain: ${residual.map((entry) => entry.id).join(', ')}`);
    const catchalls = catalog.contracts.flatMap((contract) => (contract.upstreamPathPatterns ?? []).map((pattern) => ({ id: contract.id, pattern }))).filter((entry) => entry.pattern === '^.*$');
    if (catchalls.length) fail(`Catch-all patterns remain: ${catchalls.map((entry) => entry.id).join(', ')}`);
    return { residualContracts: 0, catchallPatterns: 0 };
  },
  'single-owner'() {
    const paths = decomposition.contracts.flatMap((contract) => contract.paths.map((sourcePath) => ({ sourcePath, contractId: contract.id })));
    const seen = new Map();
    for (const entry of paths) {
      if (seen.has(entry.sourcePath)) fail(`Decomposition path has multiple owners: ${entry.sourcePath}`);
      seen.set(entry.sourcePath, entry.contractId);
    }
    if (new Set(conformance.candidateMappings.map((entry) => entry.sourcePath)).size !== conformance.candidateMappings.length) fail('Conformance contains duplicate source-path mappings');
    if (conformance.candidateMappings.length !== conformance.summary.candidateContracts) fail('Conformance candidate count mismatch');
    if (conformance.unmatchedCandidateIds.length) fail(`Unmatched candidates remain: ${conformance.unmatchedCandidateIds.length}`);
    return { decomposedPaths: paths.length, mappedCandidates: conformance.candidateMappings.length, unmatchedCandidates: 0 };
  },
  'zero-empty'() {
    const evidence = new Map(conformance.evidence.map((entry) => [entry.id, entry]));
    const empty = catalog.contracts.filter((contract) => !evidence.get(contract.id) || evidence.get(contract.id).candidateFiles < 1);
    if (empty.length) fail(`Empty contracts remain: ${empty.map((entry) => entry.id).join(', ')}`);
    return { contracts: catalog.contracts.length, emptyContracts: 0 };
  },
  'exclusion-policy'() {
    if (entitlement.schema !== 'nolane.entitlement-policy.v1' || entitlement.owner !== 'Nolane Agent') fail('Invalid Nolane entitlement policy identity');
    if (entitlement.upstreamBillingCopied !== false) fail('Upstream billing copy is forbidden');
    if (!Array.isArray(entitlement.secretFields) || entitlement.secretFields.length) fail('Entitlement policy must not contain secret fields');
    const contract = decomposition.contracts.find((entry) => entry.id === 'NATIVE-ENTITLEMENT-POLICY');
    if (!contract || contract.status !== 'verified' || contract.paths.length < 1) fail('Nolane entitlement contract is missing or not verified');
    return { upstreamBillingCopied: false, entitlementPaths: contract.paths.length, defaultTier: entitlement.defaultTier };
  },
};

const selected = mode === 'all' ? Object.keys(checks) : [mode];
for (const name of selected) if (!checks[name]) fail(`Unknown decomposition verification mode: ${name}`);
const results = Object.fromEntries(selected.map((name) => [name, checks[name]()]));
const base = { schema: 'nolane.native-core.decomposition-verification.v1', mode, status: 'pass', results };
const receiptSha256 = createHash('sha256').update(JSON.stringify(base)).digest('hex');
process.stdout.write(`${JSON.stringify({ ...base, receiptSha256 })}\n`);
