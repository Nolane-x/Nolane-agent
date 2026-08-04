import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAGES } from '../src/core/constants.mjs';

const esc = (value) => String(value ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&apos;');
const clip = (value, max = 54) => {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
};
const latestRoutes = (project) => project.routes?.at(-1)?.routes ?? [];
const latestCurrentGate = (project) => [...(project.gates ?? [])].reverse().find((gate) => gate.stage === project.stage) ?? null;

function text(x, y, value, { size = 16, fill = '#dbe7ff', weight = 500, family = 'Inter,Arial,sans-serif', anchor = 'start', opacity = 1 } = {}) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" font-family="${family}" text-anchor="${anchor}" opacity="${opacity}">${esc(value)}</text>`;
}
function rect(x, y, width, height, { fill = '#0d1528', stroke = '#283754', radius = 18, opacity = 1 } = {}) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" opacity="${opacity}"/>`;
}
function pill(x, y, label, tone = 'cyan') {
  const colors = { cyan: ['#0e2d3c', '#67e8f9'], green: ['#123326', '#68f0ad'], amber: ['#392d13', '#ffd166'], red: ['#3b1720', '#ff7189'], violet: ['#2a1d48', '#b9a2ff'] };
  const [fill, stroke] = colors[tone] ?? colors.cyan;
  const width = Math.max(62, label.length * 7.2 + 24);
  return `${rect(x, y, width, 28, { fill, stroke, radius: 14 })}${text(x + width / 2, y + 19, label, { size: 11, fill: stroke, weight: 750, anchor: 'middle' })}`;
}

export function renderDashboardSvg(project) {
  const width = 1600;
  const height = 1100;
  const routes = latestRoutes(project).slice(0, 5);
  const artifacts = (project.artifacts ?? []).slice(-7).reverse();
  const ideas = (project.ideas ?? []).slice(0, 3);
  const evidence = (project.evidence ?? []).slice(-5).reverse();
  const findings = (project.findings ?? []).filter((item) => item.status !== 'closed').slice(0, 4);
  const gate = latestCurrentGate(project);
  const stageIndex = STAGES.indexOf(project.stage);
  const parts = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`);
  parts.push('<title id="title">ForgeOS Studio evidence</title><desc id="desc">A deterministic release evidence rendering of project state, gates, artifacts, routes, ideas and findings.</desc>');
  parts.push('<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#071022"/><stop offset="0.55" stop-color="#090c18"/><stop offset="1" stop-color="#1d0f2c"/></linearGradient><linearGradient id="hero" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d2b47"/><stop offset="1" stop-color="#2a1743"/></linearGradient><filter id="shadow"><feDropShadow dx="0" dy="12" stdDeviation="18" flood-color="#000" flood-opacity=".35"/></filter></defs>');
  parts.push(`<rect width="${width}" height="${height}" fill="url(#bg)"/>`);
  parts.push('<circle cx="130" cy="20" r="260" fill="#15355b" opacity=".24"/><circle cx="1510" cy="70" r="290" fill="#51236d" opacity=".20"/>');

  parts.push(rect(32, 28, 1536, 154, { fill: 'url(#hero)', stroke: '#344968', radius: 26 }));
  parts.push(text(62, 60, 'FORGEOS · EVIDENCE-GATED PRODUCT ENGINEERING', { size: 12, fill: '#69e6ff', weight: 800, family: 'monospace' }));
  parts.push(text(62, 114, clip(project.name, 48), { size: 44, fill: '#f7f9ff', weight: 850 }));
  parts.push(text(62, 148, 'Revision-bound gates · typed artifact lineage · authenticated decisions', { size: 16, fill: '#9aaccc' }));
  parts.push(pill(1165, 68, project.stage, 'violet'));
  parts.push(pill(1165, 110, project.assurance, 'cyan'));
  parts.push(pill(1260, 110, project.domain, 'green'));
  parts.push(text(1514, 154, `r${project.revision}/s${project.semanticRevision}`, { size: 14, fill: '#9aaccc', anchor: 'end', family: 'monospace' }));

  parts.push(rect(32, 202, 248, 866, { fill: '#0b1324', stroke: '#263650', radius: 22 }));
  parts.push(text(56, 238, 'LIFECYCLE', { size: 12, fill: '#69e6ff', weight: 800, family: 'monospace' }));
  STAGES.forEach((stage, index) => {
    const y = 260 + index * 54;
    const current = stage === project.stage;
    const prior = index < stageIndex;
    const stageGate = [...(project.gates ?? [])].reverse().find((item) => item.stage === stage);
    const state = current ? 'ACTIVE' : stageGate?.status?.toUpperCase() ?? (prior ? 'STALE' : 'PENDING');
    const tone = current ? '#69e6ff' : stageGate?.status === 'pass' ? '#68f0ad' : prior ? '#ffd166' : '#64748b';
    if (current) parts.push(rect(46, y - 25, 220, 42, { fill: '#102a40', stroke: '#3bc8e8', radius: 11 }));
    parts.push(text(58, y, String(index + 1).padStart(2, '0'), { size: 12, fill: tone, weight: 800, family: 'monospace' }));
    parts.push(text(91, y, stage, { size: 13, fill: current ? '#f7f9ff' : '#b7c3d8', weight: current ? 750 : 550 }));
    parts.push(text(252, y, state, { size: 9, fill: tone, weight: 800, anchor: 'end', family: 'monospace' }));
  });

  parts.push(rect(302, 202, 1266, 160, { fill: '#0d1528', stroke: gate?.status === 'pass' ? '#28634b' : '#735b24', radius: 22 }));
  parts.push(text(330, 237, 'CURRENT GATE', { size: 12, fill: '#69e6ff', weight: 800, family: 'monospace' }));
  parts.push(text(330, 280, gate ? `${gate.stage} · ${gate.status.toUpperCase()}` : `${project.stage} · NOT EVALUATED`, { size: 28, fill: gate?.status === 'pass' ? '#68f0ad' : '#ffd166', weight: 850 }));
  parts.push(text(330, 315, gate ? `semantic revision ${gate.evaluatedSemanticRevision} · score ${gate.score}% · digest ${clip(gate.inputSha256, 18)}` : 'The next gate will evaluate the current semantic revision.', { size: 14, fill: '#9aaccc', family: 'monospace' }));
  const missing = gate?.failedRules?.length ? gate.failedRules.join(' · ') : 'No current failed-rule record';
  parts.push(text(330, 340, clip(missing, 110), { size: 13, fill: gate?.failedRules?.length ? '#ff7189' : '#8fa0be' }));

  const colW = 397;
  const colX = [302, 715, 1128];
  parts.push(rect(colX[0], 382, colW, 306, { fill: '#0d1528', stroke: '#283754', radius: 20 }));
  parts.push(text(colX[0] + 24, 418, 'IDEA MECHANISMS', { size: 12, fill: '#69e6ff', weight: 800, family: 'monospace' }));
  ideas.forEach((idea, index) => {
    const y = 454 + index * 72;
    parts.push(text(colX[0] + 24, y, `${index + 1}. ${clip(idea.title, 34)}`, { size: 15, fill: '#f2f6ff', weight: 750 }));
    parts.push(text(colX[0] + 40, y + 25, clip(idea.mechanism, 48), { size: 12, fill: '#97a8c6' }));
    parts.push(text(colX[0] + 40, y + 44, clip(idea.fingerprint, 20), { size: 10, fill: '#b9a2ff', family: 'monospace' }));
  });
  if (!ideas.length) parts.push(text(colX[0] + 24, 466, 'No candidates recorded.', { fill: '#71809b' }));

  parts.push(rect(colX[1], 382, colW, 306, { fill: '#0d1528', stroke: '#283754', radius: 20 }));
  parts.push(text(colX[1] + 24, 418, 'ARTIFACT LINEAGE', { size: 12, fill: '#69e6ff', weight: 800, family: 'monospace' }));
  artifacts.slice(0, 5).forEach((artifact, index) => {
    const y = 454 + index * 46;
    const tone = artifact.state === 'verified' ? '#68f0ad' : artifact.state === 'invalidated' ? '#ff7189' : '#ffd166';
    parts.push(text(colX[1] + 24, y, clip(artifact.type, 30), { size: 14, fill: '#f2f6ff', weight: 720 }));
    parts.push(text(colX[1] + 370, y, artifact.state, { size: 10, fill: tone, anchor: 'end', family: 'monospace', weight: 800 }));
    parts.push(text(colX[1] + 24, y + 18, `${clip(artifact.sha256, 16)} · deps ${(artifact.consumes ?? []).length}`, { size: 9, fill: '#8392ad', family: 'monospace' }));
  });
  if (!artifacts.length) parts.push(text(colX[1] + 24, 466, 'No artifacts recorded.', { fill: '#71809b' }));

  parts.push(rect(colX[2], 382, colW, 306, { fill: '#0d1528', stroke: '#283754', radius: 20 }));
  parts.push(text(colX[2] + 24, 418, 'PROOF LEDGER', { size: 12, fill: '#69e6ff', weight: 800, family: 'monospace' }));
  evidence.forEach((item, index) => {
    const y = 454 + index * 46;
    const tone = item.status === 'pass' ? '#68f0ad' : item.status === 'fail' ? '#ff7189' : '#ffd166';
    parts.push(text(colX[2] + 24, y, clip(item.type, 27), { size: 14, fill: '#f2f6ff', weight: 720 }));
    parts.push(text(colX[2] + 370, y, item.status, { size: 10, fill: tone, anchor: 'end', family: 'monospace', weight: 800 }));
    parts.push(text(colX[2] + 24, y + 18, `${clip(item.producer?.id, 22)} · s${item.subject?.semanticRevision ?? '?'}`, { size: 9, fill: '#8392ad', family: 'monospace' }));
  });
  if (!evidence.length) parts.push(text(colX[2] + 24, 466, 'No evidence recorded.', { fill: '#71809b' }));

  parts.push(rect(302, 708, 818, 360, { fill: '#0d1528', stroke: '#283754', radius: 22 }));
  parts.push(text(330, 744, 'NEXT TYPED ROUTES', { size: 12, fill: '#69e6ff', weight: 800, family: 'monospace' }));
  routes.forEach((route, index) => {
    const y = 790 + index * 52;
    parts.push(rect(324, y - 27, 774, 42, { fill: '#09111f', stroke: '#23334d', radius: 11 }));
    parts.push(text(342, y, String(index + 1).padStart(2, '0'), { size: 11, fill: '#69e6ff', family: 'monospace', weight: 800 }));
    parts.push(text(380, y, clip(route.name, 46), { size: 14, fill: '#f2f6ff', weight: 720 }));
    parts.push(text(930, y, clip((route.produces ?? []).join(', '), 34), { size: 10, fill: '#a98df7', anchor: 'end', family: 'monospace' }));
    parts.push(text(1078, y, Number(route.score ?? 0).toFixed(2), { size: 12, fill: '#68f0ad', anchor: 'end', family: 'monospace', weight: 800 }));
  });
  if (!routes.length) parts.push(text(330, 790, 'No route has been computed for this revision.', { fill: '#71809b' }));

  parts.push(rect(1140, 708, 428, 360, { fill: '#0d1528', stroke: '#283754', radius: 22 }));
  parts.push(text(1168, 744, 'OPEN RISK / FINDINGS', { size: 12, fill: '#69e6ff', weight: 800, family: 'monospace' }));
  findings.forEach((finding, index) => {
    const y = 790 + index * 64;
    const tone = finding.severity === 'critical' ? '#ff7189' : finding.severity === 'high' ? '#ff9a6b' : '#ffd166';
    parts.push(text(1168, y, clip(finding.title, 42), { size: 14, fill: '#f2f6ff', weight: 720 }));
    parts.push(text(1540, y, `${finding.severity} · ${finding.status}`, { size: 10, fill: tone, anchor: 'end', family: 'monospace', weight: 800 }));
    parts.push(text(1168, y + 22, clip(finding.category, 36), { size: 10, fill: '#8392ad', family: 'monospace' }));
  });
  if (!findings.length) parts.push(text(1168, 790, 'No open findings.', { fill: '#68f0ad' }));

  parts.push(text(32, 1090, `ForgeOS Studio evidence · ${project.id} · deterministic SVG renderer`, { size: 10, fill: '#66758f', family: 'monospace' }));
  parts.push('</svg>');
  return parts.join('');
}

async function main() {
  const dataDirectory = path.resolve(process.argv[2] ?? '.forgeos-demo-data');
  const projectId = process.argv[3];
  const output = path.resolve(process.argv[4] ?? 'evidence/dashboard.svg');
  if (!projectId) throw new Error('projectId is required');
  const project = JSON.parse(await readFile(path.join(dataDirectory, `${projectId}.json`), 'utf8'));
  await writeFile(output, `${renderDashboardSvg(project)}\n`, 'utf8');
  console.log(`Rendered ${output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { await main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
