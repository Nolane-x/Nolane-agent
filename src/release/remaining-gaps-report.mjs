import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const OPEN_STATUSES = Object.freeze(['partial', 'external_gate', 'not_implemented']);
const FEATURE_AUDIT_SCHEMAS = new Set([
  'forge.studio.feature-audit.v1',
  'forge.studio.feature-audit.frontier.v1',
  'nolane.agent.requirements.v5',
]);

function completionCondition(status) {
  if (status === 'partial') return 'Hoàn thiện hành vi item-level còn thiếu, thêm kiểm thử tự động trực tiếp và đưa bằng chứng source + test vào feature audit.';
  if (status === 'external_gate') return 'Cung cấp hạ tầng/credential/runner hoặc đánh giá độc lập thật, lưu raw evidence và receipt, rồi chạy lại full release matrix.';
  return 'Xây implementation trong source, nối vào runtime/API hoặc UI thật, thêm kiểm thử trực tiếp và chạy lại full release matrix.';
}

function freeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) freeze(child, seen);
  return Object.freeze(value);
}

export function buildRemainingGapsReport(audit) {
  if (!FEATURE_AUDIT_SCHEMAS.has(audit?.schema)) throw new TypeError('Feature audit schema is invalid');
  const isNolane = audit.schema === 'nolane.agent.requirements.v5';
  const items = [];
  const sectionSummary = [];
  if (isNolane) {
    const groups = new Map();
    for (const requirement of audit.requirements ?? []) {
      if (!OPEN_STATUSES.includes(requirement.status)) continue;
      const group = String(requirement.group ?? 'Ungrouped');
      if (!groups.has(group)) groups.set(group, { number: groups.size + 1, title: group, items: [] });
      const section = groups.get(group);
      const normalized = freeze({
        id: String(requirement.id), section: section.number, sectionTitle: section.title, text: String(requirement.title), status: requirement.status,
        evidence: freeze([requirement.acceptance?.entrypoint, requirement.acceptance?.exactTest].filter(Boolean).map(String)),
        reason: requirement.status === 'not_implemented' ? 'Chưa có implementation + proof đầy đủ trong acceptance ledger.' : 'Acceptance ledger chưa cho phép nâng lên verified_source_test.',
        completionCondition: completionCondition(requirement.status),
      });
      items.push(normalized); section.items.push(normalized);
    }
    for (const value of groups.values()) sectionSummary.push(freeze({ number: value.number, title: value.title, open: value.items.length }));
  } else {
    for (const section of audit.sections ?? []) {
      const open = [];
      for (const item of section.items ?? []) {
        if (!OPEN_STATUSES.includes(item.status)) continue;
        const normalized = freeze({
          id: String(item.id), section: Number(section.number), sectionTitle: String(section.title), text: String(item.text), status: item.status,
          evidence: freeze(Array.isArray(item.evidence) ? item.evidence.map(String) : []),
          reason: String(item.note ?? 'Chưa có lý do cụ thể trong feature audit.'), completionCondition: completionCondition(item.status),
        });
        items.push(normalized); open.push(normalized);
      }
      if (open.length) sectionSummary.push(freeze({ number: Number(section.number), title: String(section.title), open: open.length }));
    }
  }
  const summary = { partial: 0, external_gate: 0, not_implemented: 0 };
  for (const item of items) summary[item.status] += 1;
  const totalRequirements = Number(audit.totalItems ?? audit.total);
  const verified = Number((audit.summary ?? audit.statusCounts)?.verified_source_test ?? 0);
  const expectedOpen = totalRequirements - verified;
  if (items.length !== expectedOpen) throw new Error(`Remaining gaps report omitted items: expected ${expectedOpen}, found ${items.length}`);
  const base = {
    schema: isNolane ? 'nolane.agent.remaining-gaps.v1' : 'forge.studio.remaining-gaps.v1', product: isNolane ? 'Nolane Agent' : 'Forge Studio',
    productVersion: String(audit.productVersion ?? audit.version), totalRequirements,
    totalOpen: items.length, summary: freeze(summary), sections: freeze(sectionSummary), items: freeze(items), auditSha256: canonicalSha256(audit),
  };
  return freeze({ ...base, receiptSha256: canonicalSha256(base) });
}

function escapeCell(value) { return String(value ?? '').replaceAll('|', '\\|').replaceAll('\n', ' '); }
export function renderRemainingGapsMarkdown(report) {
  const grouped = new Map();
  for (const item of report.items) {
    if (!grouped.has(item.section)) grouped.set(item.section, { title: item.sectionTitle, items: [] });
    grouped.get(item.section).items.push(item);
  }
  const sections = [...grouped.entries()].map(([number, group]) => {
    const blocks = group.items.map((item) => `### ${escapeCell(item.id)} — ${escapeCell(item.text)}\n\n- **Trạng thái:** \`${item.status}\`\n- **Vì sao chưa hoàn tất:** ${escapeCell(item.reason)}\n- **Điều kiện hoàn tất:** ${escapeCell(item.completionCondition)}\n- **Bằng chứng hiện có:** ${escapeCell(item.evidence.join(', ') || 'Chưa có')}`).join('\n\n');
    return `## ${number}. ${group.title}\n\n${blocks}`;
  }).join('\n\n');
  return `# ${report.product ?? 'Forge Studio'} ${report.productVersion} — Remaining Gaps Report\n\n- Tổng yêu cầu: **${report.totalRequirements}**\n- Còn lại: **${report.totalOpen}**\n- Hoàn thành một phần: **${report.summary.partial}**\n- Cổng bên ngoài: **${report.summary.external_gate}**\n- Chưa triển khai: **${report.summary.not_implemented}**\n- Audit SHA-256: \`${report.auditSha256}\`\n- Receipt SHA-256: \`${report.receiptSha256}\`\n\n> Báo cáo này liệt kê toàn bộ item chưa ở trạng thái source + test. Không có item nào bị ẩn hoặc gộp mất.\n\n${sections || 'Không còn khoảng trống.'}\n`;
}

async function load(auditFile) { return JSON.parse(await readFile(path.resolve(auditFile), 'utf8')); }
export async function writeRemainingGapsReport({ auditFile, markdownFile, jsonFile } = {}) {
  const report = buildRemainingGapsReport(await load(auditFile));
  const markdown = renderRemainingGapsMarkdown(report);
  await mkdir(path.dirname(path.resolve(markdownFile)), { recursive: true });
  await writeFile(path.resolve(markdownFile), markdown);
  if (jsonFile) {
    await mkdir(path.dirname(path.resolve(jsonFile)), { recursive: true });
    await writeFile(path.resolve(jsonFile), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}

export async function verifyRemainingGapsReport({ auditFile, markdownFile, jsonFile } = {}) {
  const report = buildRemainingGapsReport(await load(auditFile));
  const expected = renderRemainingGapsMarkdown(report);
  let actual = '';
  try { actual = await readFile(path.resolve(markdownFile), 'utf8'); } catch {}
  if (actual !== expected) throw new Error('Remaining gaps documentation is stale');
  if (jsonFile) {
    await mkdir(path.dirname(path.resolve(jsonFile)), { recursive: true });
    await writeFile(path.resolve(jsonFile), `${JSON.stringify(report, null, 2)}\n`);
  }
  return report;
}
