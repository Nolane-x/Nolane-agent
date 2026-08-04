import crypto from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const VALID_STATUSES = new Set(['verified', 'external_gate', 'implemented_not_wired', 'not_implemented']);
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}

export function buildNativeCoreCatalog({ contracts, productVersion = '5.0.0-beta.6' } = {}) {
  const withoutReceipt = {
    schema: 'nolane.native-core.contract-catalog.v1',
    product: 'Nolane Agent',
    productVersion,
    claimPolicy: {
      fileExistenceIsProof: false,
      completeParityRequiresNoOpenCandidates: true,
      externalBehaviorRequiresExternalReceipt: true,
    },
    contracts: [...(contracts ?? [])].map((contract) => ({
      upstreamPathPatterns: [], entrypoints: [], tests: [], negativeTests: [], productionWiring: [], externalCondition: null, priority: 0,
      ...contract,
    })),
  };
  const catalog = { ...withoutReceipt, receiptSha256: sha256(JSON.stringify(canonical(withoutReceipt))) };
  validateCoreCatalog(catalog);
  return catalog;
}

export function validateCoreCatalog(catalog) {
  if (!catalog || catalog.schema !== 'nolane.native-core.contract-catalog.v1') throw new Error('invalid native core contract catalog schema');
  if (!Array.isArray(catalog.contracts)) throw new Error('native core catalog contracts must be an array');
  const ids = new Set();
  for (const contract of catalog.contracts) {
    if (!contract.id) throw new Error('native core contract id is required');
    if (ids.has(contract.id)) throw new Error(`duplicate native core contract id: ${contract.id}`);
    ids.add(contract.id);
    if (!VALID_STATUSES.has(contract.status)) throw new Error(`invalid native core contract status: ${contract.id}`);
    if (!contract.domain || !contract.title) throw new Error(`native core contract domain and title are required: ${contract.id}`);
    if (!Number.isInteger(contract.priority ?? 0)) throw new Error(`native core contract priority must be an integer: ${contract.id}`);
    for (const pattern of contract.upstreamPathPatterns ?? []) {
      try { new RegExp(pattern); } catch { throw new Error(`invalid upstream path pattern for ${contract.id}: ${pattern}`); }
    }
    if (contract.status === 'verified' || contract.status === 'external_gate') {
      if (!(contract.entrypoints ?? []).length) throw new Error(`verified contract lacks production entrypoint: ${contract.id}`);
      if (!(contract.tests ?? []).length) throw new Error(`verified contract lacks direct test: ${contract.id}`);
      if (!(contract.negativeTests ?? []).length) throw new Error(`verified contract lacks negative test: ${contract.id}`);
      if (!(contract.productionWiring ?? []).length) throw new Error(`verified contract lacks production wiring: ${contract.id}`);
      if (contract.status === 'external_gate' && !contract.externalCondition) throw new Error(`external contract lacks external condition: ${contract.id}`);
    }
  }
  if (catalog.receiptSha256) {
    const { receiptSha256, ...withoutReceipt } = catalog;
    const expected = sha256(JSON.stringify(canonical(withoutReceipt)));
    if (receiptSha256 !== expected) throw new Error('native core catalog receipt hash mismatch');
  }
  return { status: 'pass', contracts: catalog.contracts.length };
}

async function hashFile(rootDirectory, relativePath, label) {
  const absolute = path.resolve(rootDirectory, relativePath);
  const relative = path.relative(rootDirectory, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error(`${label} escapes root: ${relativePath}`);
  try { await access(absolute); } catch { throw new Error(`${label} missing: ${relativePath}`); }
  return { path: relativePath, sha256: sha256(await readFile(absolute)) };
}

async function verifyWiring(rootDirectory, wiring, contractId) {
  const source = await readFile(path.resolve(rootDirectory, wiring.path), 'utf8').catch(() => { throw new Error(`production wiring missing for ${contractId}: ${wiring.path}`); });
  if (!source.includes(wiring.contains)) throw new Error(`production wiring token missing for ${contractId}: ${wiring.path} -> ${wiring.contains}`);
  return { path: wiring.path, contains: wiring.contains, sha256: sha256(source) };
}

function matchContract(candidate, contracts) {
  const matches = contracts.filter((contract) => contract.domain === candidate.domain && (contract.upstreamPathPatterns ?? []).some((pattern) => new RegExp(pattern).test(candidate.behaviorSourcePath)));
  if (matches.length === 0) return null;
  const highestPriority = Math.max(...matches.map((entry) => entry.priority ?? 0));
  const selected = matches.filter((entry) => (entry.priority ?? 0) === highestPriority);
  if (selected.length > 1) throw new Error(`ambiguous native core mapping for ${candidate.id}: ${selected.map((entry) => entry.id).join(', ')}`);
  return selected[0];
}

export async function verifyCoreContracts({ rootDirectory = process.cwd(), catalog, nolane_nativeInventory } = {}) {
  validateCoreCatalog(catalog);
  if (!nolane_nativeInventory || !Array.isArray(nolane_nativeInventory.contracts)) throw new Error('NolaneNative core inventory contracts are required');
  const evidence = [];
  for (const contract of catalog.contracts) {
    if (contract.status !== 'verified' && contract.status !== 'external_gate') {
      evidence.push({
        id: contract.id,
        title: contract.title,
        domain: contract.domain,
        status: contract.status,
        externalCondition: contract.externalCondition ?? null,
        entrypoints: [],
        tests: [],
        negativeTests: [],
        productionWiring: [],
      });
      continue;
    }
    const [entrypoints, tests, negativeTests, productionWiring] = await Promise.all([
      Promise.all(contract.entrypoints.map((entry) => hashFile(rootDirectory, entry, 'entrypoint'))),
      Promise.all(contract.tests.map((entry) => hashFile(rootDirectory, entry, 'direct test'))),
      Promise.all(contract.negativeTests.map((entry) => hashFile(rootDirectory, entry, 'negative test'))),
      Promise.all(contract.productionWiring.map((entry) => verifyWiring(rootDirectory, entry, contract.id))),
    ]);
    evidence.push({
      id: contract.id,
      title: contract.title,
      domain: contract.domain,
      status: contract.status,
      externalCondition: contract.externalCondition ?? null,
      entrypoints,
      tests,
      negativeTests,
      productionWiring,
    });
  }

  const candidateMappings = [];
  const unmatchedCandidateIds = [];
  for (const candidate of nolane_nativeInventory.contracts) {
    const contract = matchContract(candidate, catalog.contracts);
    if (!contract) {
      unmatchedCandidateIds.push(candidate.id);
      candidateMappings.push({
        candidateId: candidate.id,
        sourcePath: candidate.behaviorSourcePath,
        sourceSha256: candidate.sourceSha256,
        domain: candidate.domain,
        contractId: null,
        status: 'not_implemented',
      });
    } else {
      candidateMappings.push({
        candidateId: candidate.id,
        sourcePath: candidate.behaviorSourcePath,
        sourceSha256: candidate.sourceSha256,
        domain: candidate.domain,
        contractId: contract.id,
        status: contract.status,
      });
    }
  }
  unmatchedCandidateIds.sort();
  candidateMappings.sort((a, b) => a.candidateId.localeCompare(b.candidateId));
  const evidenceWithUpstreamSources = evidence.map((entry) => {
    const upstreamBehaviorSources = candidateMappings
      .filter((mapping) => mapping.contractId === entry.id)
      .map((mapping) => ({
        candidateId: mapping.candidateId,
        path: mapping.sourcePath,
        sha256: mapping.sourceSha256,
      }))
      .sort((a, b) => a.path.localeCompare(b.path) || a.candidateId.localeCompare(b.candidateId));
    return {
      ...entry,
      candidateFiles: upstreamBehaviorSources.length,
      upstreamBehaviorSources,
    };
  });
  const candidateStatuses = ['verified', 'external_gate', 'implemented_not_wired', 'not_implemented'];
  const candidateStatusCounts = Object.fromEntries(candidateStatuses.map((status) => [status, candidateMappings.filter((entry) => entry.status === status).length]));
  const withoutReceipt = {
    schema: 'nolane.native-core.conformance-receipt.v1',
    productVersion: catalog.productVersion,
    catalogReceiptSha256: catalog.receiptSha256 ?? null,
    upstreamInventoryReceiptSha256: nolane_nativeInventory.receiptSha256 ?? null,
    summary: {
      contracts: catalog.contracts.length,
      verifiedContracts: catalog.contracts.filter((entry) => entry.status === 'verified').length,
      externalContracts: catalog.contracts.filter((entry) => entry.status === 'external_gate').length,
      implementedNotWiredContracts: catalog.contracts.filter((entry) => entry.status === 'implemented_not_wired').length,
      notImplementedContracts: catalog.contracts.filter((entry) => entry.status === 'not_implemented').length,
      candidateContracts: candidateMappings.length,
      matchedCandidates: candidateMappings.length - unmatchedCandidateIds.length,
      unmatchedCandidates: unmatchedCandidateIds.length,
      completeParityClaimAllowed: candidateStatusCounts.not_implemented === 0
        && candidateStatusCounts.implemented_not_wired === 0
        && candidateStatusCounts.external_gate === 0
        && unmatchedCandidateIds.length === 0
        && catalog.contracts.every((entry) => entry.status === 'verified'),
    },
    candidateStatusCounts,
    evidence: evidenceWithUpstreamSources,
    candidateMappings,
    unmatchedCandidateIds,
  };
  return { ...withoutReceipt, status: 'pass', receiptSha256: sha256(JSON.stringify(canonical(withoutReceipt))) };
}
