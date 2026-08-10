import crypto from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { migrateMasterLedgerEvidence } from '../forensics/evidence-path-migrations.mjs';
import { evidenceFileSha256 } from '../release/evidence-file-hash.mjs';

const STATUS_ORDER = Object.freeze({
  verified: 0,
  external_gate: 1,
  implemented_not_wired: 2,
  not_implemented: 3,
  unmapped: 4,
});

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

export function normalizeRequirementTitle(input) {
  return String(input ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function inferV5Status(requirement) {
  if (requirement.status === 'verified_source_test') return 'verified';
  if (requirement.status === 'external_gate') return 'external_gate';
  const text = `${requirement.group ?? ''} ${requirement.title ?? ''}`.toLowerCase();
  if (/windows|wcag|screen reader|responsive|visual|provider-real|dogfood|independent|benchmark/.test(text)) return 'external_gate';
  if (requirement.status === 'implemented_not_wired') return 'implemented_not_wired';
  return 'not_implemented';
}

function legacyStatus(status) {
  if (status === 'verified_source_test') return 'verified';
  if (status === 'external_gate') return 'external_gate';
  if (status === 'partial') return 'implemented_not_wired';
  return 'not_implemented';
}

function isTestPath(value) {
  return /^tests(?:-js)?\//.test(value) || /(?:^|\/)test[^/]*\.[cm]?[jt]sx?$/.test(value) || /\.test\.[cm]?[jt]sx?$/.test(value);
}

function sourceAlias({ source, id, title, group, status, acceptance = {}, metadata = {} }) {
  return { source, id, title, group, status, acceptance, metadata };
}

function collectAliases({ legacyAudit, nolaneV5, nolane_nativeInventory, nativeConformance, releaseMatrix }) {
  const aliases = [];
  const conformanceMappings = new Map((nativeConformance?.candidateMappings ?? []).map((entry) => [entry.candidateId, entry]));
  const conformanceEvidence = new Map((nativeConformance?.evidence ?? []).map((entry) => [entry.id, entry]));
  for (const section of legacyAudit.sections ?? []) {
    for (const item of section.items ?? []) {
      const evidence = Array.isArray(item.evidence) ? item.evidence : [];
      aliases.push(sourceAlias({
        source: 'legacy',
        id: item.id,
        title: item.text,
        group: section.title,
        status: legacyStatus(item.status),
        acceptance: {
          productionEntryPoints: evidence.filter((entry) => !isTestPath(entry)),
          testPaths: evidence.filter(isTestPath),
          externalCondition: item.status === 'external_gate' ? item.note ?? item.text : null,
          fileExistenceIsProof: false,
        },
        metadata: { section: section.number, sourceStatus: item.status, note: item.note ?? null },
      }));
    }
  }
  for (const requirement of nolaneV5.requirements ?? []) {
    const acceptance = requirement.acceptance ?? {};
    aliases.push(sourceAlias({
      source: 'nolaneV5',
      id: requirement.id,
      title: requirement.title,
      group: requirement.group,
      status: inferV5Status(requirement),
      acceptance: {
        productionEntryPoints: acceptance.entrypoint ? [acceptance.entrypoint] : [],
        testPaths: acceptance.exactTest ? [acceptance.exactTest] : [],
        externalCondition: requirement.status === 'verified_source_test' ? null : acceptance.observableBehavior ?? requirement.title,
        fileExistenceIsProof: false,
        suppliedHashes: acceptance.evidence ?? {},
      },
      metadata: { sourceStatus: requirement.status, proofObligations: acceptance.proofObligations ?? [] },
    }));
  }
  if (nativeConformance) {
    for (const evidence of nativeConformance.evidence ?? []) {
      const status = evidence.status === 'verified' ? 'verified'
        : evidence.status === 'external_gate' ? 'external_gate'
          : evidence.status === 'implemented_not_wired' ? 'implemented_not_wired'
            : 'not_implemented';
      aliases.push(sourceAlias({
        source: 'nolane_nativeCore',
        id: evidence.id,
        title: evidence.title ?? `Nolane native behavior ${evidence.id}`,
        group: evidence.domain ?? 'native-core',
        status,
        acceptance: {
          productionEntryPoints: (evidence.entrypoints ?? []).map((entry) => entry.path),
          testPaths: (evidence.tests ?? []).map((entry) => entry.path),
          negativeTestPaths: (evidence.negativeTests ?? []).map((entry) => entry.path),
          productionEntrypoint: evidence.entrypoints?.[0]?.path ?? null,
          upstreamBehaviorSources: evidence.upstreamBehaviorSources ?? [],
          externalCondition: status === 'external_gate' ? evidence.externalCondition : null,
          fileExistenceIsProof: false,
        },
        metadata: {
          nativeContractId: evidence.id,
          conformanceStatus: evidence.status,
          upstreamCandidateFiles: evidence.candidateFiles ?? 0,
        },
      }));
    }
    for (const mapping of nativeConformance.candidateMappings ?? []) {
      if (mapping.contractId) continue;
      aliases.push(sourceAlias({
        source: 'nolane_nativeCore',
        id: mapping.candidateId,
        title: `Unmapped upstream behavior ${mapping.domain}: ${mapping.sourcePath}`,
        group: mapping.domain,
        status: 'not_implemented',
        acceptance: {
          productionEntryPoints: [],
          testPaths: [],
          negativeTestPaths: [],
          upstreamBehaviorSources: [{ candidateId: mapping.candidateId, path: mapping.sourcePath, sha256: mapping.sourceSha256 }],
          externalCondition: null,
          fileExistenceIsProof: false,
        },
        metadata: { nativeContractId: null, conformanceStatus: 'not_implemented', upstreamCandidateFiles: 1 },
      }));
    }
  } else {
    for (const contract of nolane_nativeInventory.contracts ?? []) {
      const mapping = conformanceMappings.get(contract.id) ?? null;
      const evidence = mapping?.contractId ? conformanceEvidence.get(mapping.contractId) ?? null : null;
      const mappedStatus = mapping?.status ?? contract.status;
      const status = mappedStatus === 'verified' ? 'verified'
        : mappedStatus === 'external_gate' ? 'external_gate'
          : mappedStatus === 'implemented_not_wired' ? 'implemented_not_wired'
            : 'not_implemented';
      aliases.push(sourceAlias({
        source: 'nolane_nativeCore',
        id: contract.id,
        title: `NolaneNative behavior ${contract.domain}: ${contract.behaviorSourcePath}`,
        group: contract.domain,
        status,
        acceptance: {
          productionEntryPoints: (evidence?.entrypoints ?? []).map((entry) => entry.path),
          testPaths: (evidence?.tests ?? []).map((entry) => entry.path),
          negativeTestPaths: (evidence?.negativeTests ?? []).map((entry) => entry.path),
          productionEntrypoint: evidence?.entrypoints?.[0]?.path ?? null,
          upstreamBehaviorSources: [{ candidateId: contract.id, path: contract.behaviorSourcePath, sha256: contract.sourceSha256 }],
          externalCondition: status === 'external_gate' ? `External runtime certification required for ${contract.behaviorSourcePath}` : null,
          fileExistenceIsProof: false,
        },
        metadata: { inventoryStatus: contract.status, nativeContractId: mapping?.contractId ?? null, conformanceStatus: mapping?.status ?? null },
      }));
    }
  }
  for (const gate of releaseMatrix?.gates ?? []) {
    aliases.push(sourceAlias({
      source: 'releaseGate',
      id: gate.id ?? gate.name,
      title: `Release gate: ${gate.name ?? gate.id}`,
      group: 'Release matrix',
      status: gate.status === 'pass' ? 'verified' : 'not_implemented',
      acceptance: {
        productionEntryPoints: gate.entrypoint ? [gate.entrypoint] : ['src/release/full-release-matrix.mjs'],
        testPaths: gate.test ? [gate.test] : [],
        externalCondition: gate.status === 'pass' ? null : gate.reason ?? 'release gate not passed',
        fileExistenceIsProof: false,
      },
      metadata: { gateStatus: gate.status },
    }));
  }
  return aliases;
}

function mergeAcceptance(aliases) {
  const productionEntryPoints = [...new Set(aliases.flatMap((alias) => alias.acceptance.productionEntryPoints ?? []))].sort();
  const testPaths = [...new Set(aliases.flatMap((alias) => alias.acceptance.testPaths ?? []))].sort();
  const negativeTestPaths = [...new Set(aliases.flatMap((alias) => alias.acceptance.negativeTestPaths ?? []))].sort();
  const externalConditions = [...new Set(aliases.map((alias) => alias.acceptance.externalCondition).filter(Boolean))].sort();
  const suppliedHashes = Object.assign({}, ...aliases.map((alias) => alias.acceptance.suppliedHashes ?? {}));
  const upstreamBehaviorSources = [...new Map(
    aliases.flatMap((alias) => alias.acceptance.upstreamBehaviorSources ?? [])
      .map((entry) => [`${entry.candidateId ?? ''}\0${entry.path}\0${entry.sha256 ?? ''}`, entry]),
  ).values()].sort((a, b) => a.path.localeCompare(b.path) || String(a.candidateId ?? '').localeCompare(String(b.candidateId ?? '')));
  return {
    fileExistenceIsProof: false,
    productionEntrypoint: productionEntryPoints[0] ?? null,
    productionEntryPoints,
    testPaths,
    negativeTestPaths,
    externalConditions,
    evidenceHashes: {},
    suppliedHashes,
    upstreamBehaviorSources,
  };
}

function strictestStatus(aliases) {
  return aliases.reduce((selected, alias) => STATUS_ORDER[alias.status] > STATUS_ORDER[selected] ? alias.status : selected, 'verified');
}

export function generateMasterLedger({ legacyAudit, nolaneV5, nolane_nativeInventory, nativeConformance = null, releaseMatrix = null } = {}) {
  if (!legacyAudit || !nolaneV5 || !nolane_nativeInventory) throw new Error('legacyAudit, nolaneV5 and nolane_nativeInventory are required');
  if (nativeConformance && nativeConformance.schema !== 'nolane.native-core.conformance-receipt.v1') throw new Error('invalid native conformance receipt schema');
  const aliases = collectAliases({ legacyAudit, nolaneV5, nolane_nativeInventory, nativeConformance, releaseMatrix });
  const groups = new Map();
  for (const alias of aliases) {
    const normalizedTitle = normalizeRequirementTitle(alias.title);
    const key = alias.source === 'nolane_nativeCore'
      ? `nolane_nativeCore:${alias.id}`
      : normalizedTitle || `${alias.source}:${alias.id}`;
    if (!groups.has(key)) groups.set(key, { normalizedTitle, aliases: [] });
    groups.get(key).aliases.push(alias);
  }
  const requirements = [...groups.entries()].map(([groupKey, group]) => {
    const groupedAliases = group.aliases;
    groupedAliases.sort((a, b) => `${a.source}:${a.id}`.localeCompare(`${b.source}:${b.id}`));
    const status = strictestStatus(groupedAliases);
    return {
      id: `MASTER-${sha256(groupKey).slice(0, 16).toUpperCase()}`,
      title: groupedAliases[0].title,
      normalizedTitle: group.normalizedTitle,
      group: groupedAliases[0].group,
      status,
      aliases: groupedAliases.map((alias) => ({ source: alias.source, id: alias.id, status: alias.status })),
      acceptance: mergeAcceptance(groupedAliases),
      metadata: { sources: [...new Set(groupedAliases.map((alias) => alias.source))].sort() },
    };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const statusCounts = Object.fromEntries(Object.keys(STATUS_ORDER).map((status) => [status, requirements.filter((entry) => entry.status === status).length]));
  const withoutReceipt = {
    schema: 'nolane.master.acceptance-ledger.v1',
    product: 'Nolane Agent',
    productVersion: nolaneV5.version ?? nolaneV5.productVersion,
    sourceSnapshots: {
      legacyVersion: legacyAudit.productVersion,
      nolaneV5Version: nolaneV5.version ?? nolaneV5.productVersion,
      nolane_nativeTreeSha256: nolane_nativeInventory.sourceSnapshot?.treeSha256,
      nolane_nativeInventoryReceiptSha256: nolane_nativeInventory.receiptSha256,
      nativeConformanceReceiptSha256: nativeConformance?.receiptSha256 ?? null,
    },
    sources: {
      legacy: { inputItems: (legacyAudit.sections ?? []).flatMap((section) => section.items ?? []).length },
      nolaneV5: { inputItems: (nolaneV5.requirements ?? []).length },
      nolane_nativeCore: {
        inputItems: nativeConformance
          ? (nativeConformance.evidence ?? []).length + (nativeConformance.candidateMappings ?? []).filter((entry) => !entry.contractId).length
          : (nolane_nativeInventory.contracts ?? []).length,
        upstreamCandidateFiles: (nolane_nativeInventory.contracts ?? []).length,
      },
      releaseGate: { inputItems: (releaseMatrix?.gates ?? []).length },
    },
    evidencePolicy: { requireFreshHashes: false, fileExistenceIsProof: false },
    summary: {
      inputItems: aliases.length,
      canonicalItems: requirements.length,
      deduplicatedAliases: aliases.length - requirements.length,
      statusCounts,
    },
    requirements,
  };
  const migratedWithoutReceipt = migrateMasterLedgerEvidence(withoutReceipt);
  const ledger = { ...migratedWithoutReceipt, receiptSha256: sha256(JSON.stringify(canonical(migratedWithoutReceipt))) };
  validateMasterLedger(ledger);
  return ledger;
}

export async function hydrateMasterLedgerEvidence(ledger, { rootDirectory = process.cwd() } = {}) {
  const hydrated = structuredClone(ledger);
  const allPaths = new Set();
  for (const requirement of hydrated.requirements) {
    for (const value of [...requirement.acceptance.productionEntryPoints, ...requirement.acceptance.testPaths, ...requirement.acceptance.negativeTestPaths]) allPaths.add(value);
  }
  const hashes = {};
  for (const relativePath of [...allPaths].sort()) {
    const absolute = path.resolve(rootDirectory, relativePath);
    try {
      await access(absolute);
      hashes[relativePath] = evidenceFileSha256(await readFile(absolute));
    } catch {
      // Historical aliases may point at files that were superseded. Missing paths stay visible but are not fresh evidence.
    }
  }
  for (const requirement of hydrated.requirements) {
    requirement.acceptance.evidenceHashes = Object.fromEntries(
      [...requirement.acceptance.productionEntryPoints, ...requirement.acceptance.testPaths, ...requirement.acceptance.negativeTestPaths]
        .filter((entry) => hashes[entry])
        .sort()
        .map((entry) => [entry, hashes[entry]]),
    );
  }
  hydrated.evidencePolicy.requireFreshHashes = true;
  const { receiptSha256: _old, ...withoutReceipt } = hydrated;
  hydrated.receiptSha256 = sha256(JSON.stringify(canonical(withoutReceipt)));
  validateMasterLedger(hydrated);
  return hydrated;
}

export function validateMasterLedger(ledger) {
  if (!ledger || ledger.schema !== 'nolane.master.acceptance-ledger.v1') throw new Error('invalid master acceptance ledger schema');
  if (!Array.isArray(ledger.requirements)) throw new Error('invalid master acceptance requirements');
  if (ledger.summary.inputItems !== ledger.requirements.reduce((sum, entry) => sum + entry.aliases.length, 0)) throw new Error('master ledger input count mismatch');
  if (ledger.summary.canonicalItems !== ledger.requirements.length) throw new Error('master ledger canonical count mismatch');
  const ids = new Set();
  for (const requirement of ledger.requirements) {
    if (ids.has(requirement.id)) throw new Error(`duplicate master requirement id: ${requirement.id}`);
    ids.add(requirement.id);
    if (!(requirement.status in STATUS_ORDER)) throw new Error(`invalid master requirement status: ${requirement.status}`);
    if (requirement.acceptance.fileExistenceIsProof !== false) throw new Error(`file existence cannot prove ${requirement.id}`);
    if (requirement.status === 'verified') {
      if (!requirement.acceptance.productionEntryPoints.length) throw new Error(`verified requirement lacks production entrypoint evidence: ${requirement.id}`);
      if (!requirement.acceptance.testPaths.length) throw new Error(`verified requirement lacks direct test evidence: ${requirement.id}`);
      if (ledger.evidencePolicy.requireFreshHashes) {
        const hashes = requirement.acceptance.evidenceHashes ?? {};
        if (!requirement.acceptance.productionEntryPoints.some((entry) => /^[a-f0-9]{64}$/.test(hashes[entry] ?? ''))) throw new Error(`verified requirement lacks fresh production hash: ${requirement.id}`);
        if (!requirement.acceptance.testPaths.some((entry) => /^[a-f0-9]{64}$/.test(hashes[entry] ?? ''))) throw new Error(`verified requirement lacks fresh test hash: ${requirement.id}`);
      }
    }
  }
  const { receiptSha256, ...withoutReceipt } = ledger;
  if (receiptSha256 !== sha256(JSON.stringify(canonical(withoutReceipt)))) throw new Error('master ledger receipt hash mismatch');
  return { status: 'pass', receiptSha256, canonicalItems: ledger.requirements.length, statusCounts: ledger.summary.statusCounts };
}
