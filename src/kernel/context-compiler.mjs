import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
import { boundedInteger, deepFreeze, estimateTokens, nowIso, signed, uniqueStrings } from './kernel-utils.mjs';

const DEFAULT_LANES = Object.freeze({ instructions: 0.17, objective: 0.08, repository: 0.30, evidence: 0.17, memory: 0.10, transcript: 0.10, tools: 0.08 });
const TRUST_WEIGHT = Object.freeze({ managed: 1, project: 0.92, user: 0.82, local: 0.75, external: 0.35, untrusted: 0.1 });
const SOURCE_WEIGHT = Object.freeze({ instruction: 1, objective: 1, repository: 0.9, evidence: 0.95, memory: 0.72, transcript: 0.62, tool: 0.55 });

function words(value) { return new Set(String(value ?? '').toLowerCase().match(/[\p{L}\p{N}_$.-]{2,}/gu) ?? []); }
function overlap(left, right) { if (!left.size || !right.size) return 0; let hits = 0; for (const item of left) if (right.has(item)) hits += 1; return hits / Math.sqrt(left.size * right.size); }
function freshness(updatedAt) { const age = Date.now() - Date.parse(String(updatedAt ?? '')); if (!Number.isFinite(age) || age < 0) return 0.5; const days = age / 86_400_000; return Math.max(0.15, Math.exp(-days / 60)); }
function normalizePath(value) { return String(value ?? '').replaceAll('\\', '/').replace(/^\.\//, ''); }
function globMatch(path, glob) {
  const escaped = String(glob).replace(/[.+^${}()|[\]\\]/g, '\\$&').replaceAll('**', '\u0000').replaceAll('*', '[^/]*').replaceAll('?', '[^/]').replaceAll('\u0000', '.*');
  return new RegExp(`^${escaped}$`).test(path);
}
function inScope(item, targetPaths) {
  const globs = uniqueStrings(item.pathGlobs ?? item.pathScopes ?? item.paths ?? []);
  if (!globs.length || !targetPaths.length) return true;
  return targetPaths.some((path) => globs.some((glob) => globMatch(path, glob)));
}
function normalizeLaneShares(value = {}) {
  const merged = { ...DEFAULT_LANES, ...(value ?? {}) };
  const positive = Object.fromEntries(Object.entries(merged).map(([key, amount]) => [key, Math.max(0, Number(amount) || 0)]));
  const total = Object.values(positive).reduce((sum, amount) => sum + amount, 0) || 1;
  return deepFreeze(Object.fromEntries(Object.entries(positive).map(([key, amount]) => [key, amount / total])));
}
function safeContent(value, maxBytes = 500_000) {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) return text;
  return `${Buffer.from(text).subarray(0, maxBytes).toString('utf8')}\n[truncated by context compiler]`;
}
function normalizeItem(raw, lane, index, queryTerms, targetPaths) {
  const content = safeContent(raw?.content ?? raw?.text ?? raw?.source ?? raw ?? '');
  const trust = String(raw?.trust ?? (lane === 'instructions' ? 'project' : 'local'));
  const itemTerms = words(`${raw?.title ?? ''} ${raw?.path ?? ''} ${content}`);
  const relevance = overlap(queryTerms, itemTerms);
  const sourceWeight = SOURCE_WEIGHT[raw?.kind ?? lane.replace(/s$/, '')] ?? SOURCE_WEIGHT[lane.replace(/s$/, '')] ?? 0.5;
  const trustWeight = TRUST_WEIGHT[trust] ?? 0.4;
  const fresh = freshness(raw?.updatedAt ?? raw?.createdAt);
  const priority = Math.max(0, Math.min(1, Number(raw?.priority ?? 0.5)));
  const scoped = inScope(raw ?? {}, targetPaths);
  const score = scoped ? (sourceWeight * 0.28 + trustWeight * 0.22 + fresh * 0.12 + relevance * 0.28 + priority * 0.10) : -1;
  const base = {
    id: String(raw?.id ?? `${lane}-${index}`), lane, kind: String(raw?.kind ?? lane.replace(/s$/, '')), title: String(raw?.title ?? raw?.path ?? `${lane} item ${index + 1}`).slice(0, 512),
    path: raw?.path ? normalizePath(raw.path) : null, pathGlobs: uniqueStrings(raw?.pathGlobs ?? raw?.pathScopes ?? raw?.paths ?? []), trust,
    updatedAt: raw?.updatedAt ?? raw?.createdAt ?? null, priority, relevance: Number(relevance.toFixed(6)), score: Number(score.toFixed(6)),
    content, tokenEstimate: estimateTokens(content), sourceReceiptSha256: raw?.receiptSha256 ?? raw?.sourceReceiptSha256 ?? null,
    contentSha256: canonicalSha256(content), metadata: raw?.metadata && typeof raw.metadata === 'object' ? JSON.parse(JSON.stringify(raw.metadata)) : {},
  };
  return deepFreeze(base);
}

function compactTranscript(transcript, budget) {
  const rows = Array.isArray(transcript) ? transcript : [];
  const normalized = rows.map((item, index) => ({
    id: String(item?.id ?? `turn-${index}`), role: String(item?.role ?? 'unknown'),
    content: safeContent(item?.content ?? item?.text ?? '', 100_000), createdAt: item?.createdAt ?? null,
    receiptSha256: item?.receiptSha256 ?? null,
  }));
  const tail = []; let used = 0;
  for (let index = normalized.length - 1; index >= 0; index -= 1) {
    const row = normalized[index]; const tokens = estimateTokens(row.content);
    if (used + tokens > Math.max(64, Math.floor(budget * 0.72)) && tail.length) break;
    tail.unshift(row); used += tokens;
  }
  const historical = normalized.slice(0, Math.max(0, normalized.length - tail.length));
  const decisions = []; const failures = []; const files = new Set(); const commands = new Set();
  for (const row of historical) {
    const text = row.content;
    for (const match of text.matchAll(/(?:decided|decision|chọn|quyết định)[:\s-]+([^\n.]{8,220})/gi)) decisions.push(match[1].trim());
    for (const match of text.matchAll(/(?:failed|error|failure|lỗi)[:\s-]+([^\n.]{8,220})/gi)) failures.push(match[1].trim());
    for (const match of text.matchAll(/\b(?:src|tests?|ui-v3|scripts|docs)\/[A-Za-z0-9_./-]+/g)) files.add(match[0]);
    for (const match of text.matchAll(/`([^`\n]{2,160})`/g)) commands.add(match[1]);
  }
  const summary = historical.length ? {
    schema: 'nolane.context-transcript-compaction.v1', turnsCompacted: historical.length,
    decisions: uniqueStrings(decisions, { maxItems: 24, maxLength: 240 }), failures: uniqueStrings(failures, { maxItems: 24, maxLength: 240 }),
    referencedFiles: uniqueStrings([...files], { maxItems: 64, maxLength: 500 }), commandsAndSymbols: uniqueStrings([...commands], { maxItems: 48, maxLength: 200 }),
    sourceReceiptSha256: canonicalSha256(historical.map((item) => ({ id: item.id, role: item.role, content: item.content, receiptSha256: item.receiptSha256 }))),
  } : null;
  return { tail, summary, omittedTurns: historical.length };
}

export class SovereignContextCompiler {
  constructor({ clock = Date.now } = {}) { this.clock = clock; }

  compile({ thread, objective = null, targetPaths = [], tokenBudget = 64_000, laneShares = {}, instructions = [], repository = [], evidence = [], memories = [], transcript = [], tools = [], policy = {} } = {}) {
    const budget = boundedInteger(tokenBudget, 64_000, 1_024, 1_000_000, 'tokenBudget');
    const paths = uniqueStrings(targetPaths, { maxItems: 256, maxLength: 2_000 }).map(normalizePath);
    const objectiveText = String(objective ?? thread?.objective ?? '').trim();
    if (!objectiveText) throw new TypeError('context objective is required');
    const queryTerms = words(`${objectiveText} ${paths.join(' ')}`);
    const shares = normalizeLaneShares(laneShares);
    const sourceMap = { instructions, repository, evidence, memory: memories, transcript: [], tools };
    const selected = []; const omitted = []; const laneUsage = {};
    const transcriptBudget = Math.max(128, Math.floor(budget * shares.transcript));
    const compacted = compactTranscript(transcript, transcriptBudget);
    sourceMap.transcript = [
      ...(compacted.summary ? [{ id: 'transcript-summary', title: 'Compacted historical transcript', content: compacted.summary, trust: 'local', priority: 0.9, receiptSha256: compacted.summary.sourceReceiptSha256 }] : []),
      ...compacted.tail.map((item) => ({ id: item.id, title: `${item.role} turn`, content: item.content, trust: 'local', priority: 0.8, updatedAt: item.createdAt, receiptSha256: item.receiptSha256 })),
    ];
    const objectiveItem = normalizeItem({ id: 'objective', title: 'Active objective', content: objectiveText, trust: 'managed', priority: 1 }, 'objective', 0, queryTerms, paths);
    const lanes = ['instructions', 'objective', 'repository', 'evidence', 'memory', 'transcript', 'tools'];
    const allByLane = new Map();
    for (const lane of lanes) {
      const raws = lane === 'objective' ? [objectiveItem] : (sourceMap[lane] ?? []);
      const items = lane === 'objective' ? raws : raws.map((item, index) => normalizeItem(item, lane, index, queryTerms, paths));
      const unique = new Map();
      for (const item of items) {
        if (item.score < 0) { omitted.push({ ...item, reason: 'path-scope-mismatch' }); continue; }
        const key = item.contentSha256;
        const existing = unique.get(key);
        if (!existing || existing.score < item.score) unique.set(key, item);
      }
      allByLane.set(lane, [...unique.values()].sort((a, b) => b.score - a.score || a.tokenEstimate - b.tokenEstimate));
    }
    let remaining = budget;
    for (const lane of lanes) {
      const laneBudget = Math.min(remaining, Math.max(lane === 'objective' ? 64 : 0, Math.floor(budget * (shares[lane] ?? 0))));
      let used = 0;
      for (const item of allByLane.get(lane) ?? []) {
        if (used + item.tokenEstimate <= laneBudget || (lane === 'objective' && used === 0)) {
          selected.push(item); used += item.tokenEstimate; remaining -= item.tokenEstimate;
        } else omitted.push({ ...item, reason: 'lane-budget-exhausted' });
      }
      laneUsage[lane] = { budget: laneBudget, used, selected: selected.filter((item) => item.lane === lane).length, omitted: omitted.filter((item) => item.lane === lane).length };
    }
    if (remaining > 0) {
      const spill = omitted.filter((item) => item.reason === 'lane-budget-exhausted').sort((a, b) => b.score - a.score || a.tokenEstimate - b.tokenEstimate);
      for (const item of spill) {
        if (item.tokenEstimate > remaining) continue;
        selected.push(item); remaining -= item.tokenEstimate;
        const index = omitted.indexOf(item); if (index >= 0) omitted.splice(index, 1);
        laneUsage[item.lane].used += item.tokenEstimate; laneUsage[item.lane].selected += 1; laneUsage[item.lane].omitted -= 1;
      }
    }
    const used = budget - remaining;
    const base = {
      schema: 'nolane.sovereign-context-packet.v1', threadId: thread?.id ?? null, projectId: thread?.projectId ?? null,
      objective: objectiveText, targetPaths: paths, tokenBudget: budget, tokenEstimate: used, utilization: Number((used / budget).toFixed(6)),
      laneShares: shares, laneUsage: deepFreeze(laneUsage), segments: deepFreeze(selected.sort((a, b) => lanes.indexOf(a.lane) - lanes.indexOf(b.lane) || b.score - a.score)),
      omissions: deepFreeze(omitted.map(({ content, ...item }) => ({ ...item, contentPreview: content.slice(0, 240) }))),
      compaction: deepFreeze({ omittedTurns: compacted.omittedTurns, retainedTurns: compacted.tail.length, summaryCreated: Boolean(compacted.summary) }),
      policy: deepFreeze({ maxUntrustedTokens: Number(policy.maxUntrustedTokens ?? Math.floor(budget * 0.08)), failClosedOnManagedInstructionConflict: policy.failClosedOnManagedInstructionConflict !== false }),
      generatedAt: nowIso(this.clock), claims: deepFreeze({ hiddenReasoningStored: false, sourceContentFabricated: false, omittedContentRepresentedAsLoaded: false }),
    };
    const packet = signed(base);
    const untrustedTokens = packet.segments.filter((item) => ['external', 'untrusted'].includes(item.trust)).reduce((sum, item) => sum + item.tokenEstimate, 0);
    if (untrustedTokens > packet.policy.maxUntrustedTokens) throw Object.assign(new Error(`untrusted context budget exceeded: ${untrustedTokens}`), { code: 'SOVEREIGN_CONTEXT_UNTRUSTED_BUDGET' });
    return packet;
  }
}
