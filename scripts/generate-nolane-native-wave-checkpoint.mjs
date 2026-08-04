#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { buildExternalCertificationCheckpoint } from '../src/native-core/external-certification-checkpoint.mjs';

const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));

function render(checkpoint) {
  const lines = [
    '# Nolane Agent — NolaneNative-to-Nolane Native Wave Checkpoint',
    '',
    `Checkpoint: **${checkpoint.checkpointVersion}**`,
    '',
    '## Trạng thái trung thực',
    '',
    '- **Waves 6–15: local core implemented and verified.**',
    `- Behavioral contracts: **${checkpoint.localCore.contracts}**; verified local: **${checkpoint.localCore.verifiedContracts}**; external: **${checkpoint.external.externalContracts}**.`,
    `- Upstream paths: **${checkpoint.localCore.mappedPaths}/2,110 mapped**; verified local: **${checkpoint.localCore.verifiedPaths}**; external certification: **${checkpoint.external.externalPaths}**; unmapped: **${checkpoint.external.unmappedPaths}**.`,
    '- **Waves 16–19: blocked by external certification.**',
    '- Không tuyên bố complete parity hoặc superiority khi chưa có Windows, credential thật, dogfood và independent review.',
    '',
    '## Waves 6–15 đã đưa vào checkpoint',
    '',
    '| Wave | Phạm vi | Kết quả |',
    '|---:|---|---|',
    '| 6 | Residual contract decomposition | Không còn catch-all; single-owner mapping; zero empty contract |',
    '| 7 | Tool execution và remote environment core | Local process/TCK/daemon/watchdog/artifact transfer; remote adapters fail-closed |',
    '| 8 | Session và conversation core | 10k resume, correction/undo, compression lineage, drift, leases |',
    '| 9 | Provider transport và ACP/API core | Unified protocol parsers, streaming, tool assembly, retry/cancel/cost |',
    '| 10 | Gateway và messaging core | Shared adapter TCK, pairing, idempotency, reconnect, drain |',
    '| 11 | Browser/computer-use core | Isolation, network policy, approval, quarantine, recovery, replay receipts |',
    '| 12 | Memory/plugin/scheduler/Kanban/observability | Local framework cores and negative-path tests |',
    '| 13 | Secret/auth/pairing/trust core | PKCE, one-time state, credential references, revoke downgrade |',
    '| 14 | Media/vision/voice core | Content-addressed media, provider TCK, recorder/VAD/barge-in |',
    '| 15 | Product surfaces/configuration core | Shared state projection and versioned fail-closed configuration |',
    '',
    '## External contracts còn mở',
    '',
    ...checkpoint.external.contracts.map((entry) => `- \`${entry.id}\` — ${entry.pathCount} paths (${entry.domains.join(', ')})`),
    '',
    '## Nolane acceptance gaps còn mở',
    '',
    ...checkpoint.external.openNolaneRequirements.map((entry) => `- \`${entry.id}\` — ${entry.title}`),
    '',
    '## Wave 16–19 gate',
    '',
    '- Wave 16 cần Windows 11 x64 8 GB được gắn nhãn, NSIS install/upgrade/uninstall, Authenticode, visual/performance/accessibility receipts.',
    '- Wave 17 cần credential reference và receipt môi trường thật cho provider/integration; mock không được chấp nhận.',
    '- Wave 18 cần chạy đủ 10 dogfood scenario và adversarial replay trên Windows.',
    '- Wave 19 chỉ mở khi external contract = 0, Nolane gap = 0 và independent parity review pass.',
    '',
    `Checkpoint receipt SHA-256: \`${checkpoint.receiptSha256}\``,
    '',
    '`completeParityClaimAllowed=false`',
    '',
    '`superiorityClaimAllowed=false`',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

const conformance = await readJson('requirements/nolane-native-core-conformance.json');
const requirements = await readJson('requirements/nolane-agent-v5-requirements.json');
const packageMetadata = await readJson('package.json');
const checkpoint = buildExternalCertificationCheckpoint({
  conformance,
  requirements,
  platform: process.platform,
  machine: { label: process.env.NOLANE_MACHINE_LABEL ?? 'local-sandbox', ramGb: Number(process.env.NOLANE_MACHINE_RAM_GB ?? 0) || null },
  checkpointVersion: `${packageMetadata.version}-wave15-checkpoint.1`,
});
await writeFile('requirements/nolane-native-wave-checkpoint.json', `${JSON.stringify(checkpoint, null, 2)}\n`);
await writeFile('docs/NOLANE-NATIVE-WAVE-CHECKPOINT.md', render(checkpoint));
process.stdout.write(`${JSON.stringify({ status: 'pass', checkpointVersion: checkpoint.checkpointVersion, verifiedContracts: checkpoint.localCore.verifiedContracts, externalContracts: checkpoint.external.externalContracts, receiptSha256: checkpoint.receiptSha256 })}\n`);
