import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { renderActivityView } from '../ui-v3/views/activity/activity-view.mjs';

const indexUrl = new URL('../ui-v3/styles/index.css', import.meta.url);
const prooflineUrl = new URL('../ui-v3/styles/pages/mission-proofline.css', import.meta.url);
const synthesisUrl = new URL('../docs/ui/nui-flagship-visual-synthesis-v1.md', import.meta.url);

function fixtureState() {
  return {
    status: 'ready',
    language: 'en',
    experience: 'studio',
    filter: 'all',
    follow: true,
    selectedMissionId: 'mission-proofline-fixture',
    missions: [{
      id: 'mission-proofline-fixture',
      objective: 'Ship a trustworthy provider integration without losing evidence lineage',
      status: 'testing',
      metadata: { summary: 'Plan, implementation, verification and recovery remain visible in one mission surface.' },
    }],
    tasks: [
      { id: 'task-plan', missionId: 'mission-proofline-fixture', title: 'Contract the provider boundary', role: 'planner', status: 'completed' },
      { id: 'task-build', missionId: 'mission-proofline-fixture', title: 'Implement the safe adapter', role: 'builder', status: 'completed' },
      { id: 'task-verify', missionId: 'mission-proofline-fixture', title: 'Verify with independent evidence', role: 'reviewer', status: 'testing' },
    ],
    story: {
      schema: 'nolane.execution-story.v1',
      summary: { filesRead: 8, filesChanged: 3, commands: 5, tests: 12, approvals: 1, state: 'testing', currentPhase: 'Verify', events: 17 },
      phases: [
        { title: 'Understand', state: 'completed', summary: 'Mapped provider and evidence boundaries.', eventCount: 4, metrics: { files: 4 }, receiptSha256: '1'.repeat(64) },
        { title: 'Build', state: 'completed', summary: 'Implemented the bounded adapter.', eventCount: 7, metrics: { files: 3 }, receiptSha256: '2'.repeat(64) },
        { title: 'Verify', state: 'running', summary: 'Running tests and independent checks.', eventCount: 6, metrics: { tests: 12 }, receiptSha256: '3'.repeat(64) },
      ],
      receiptSha256: '4'.repeat(64),
    },
    timeTravel: {
      checkpoints: [{ id: 'cp-1', label: 'Before provider adapter', createdAt: '2026-08-14T09:00:00Z', git: { dirty: false }, completeWorkingTreeCapture: true, receiptSha256: '5'.repeat(64) }],
      selectedCheckpointId: 'cp-1',
      comparison: { checkpointId: 'cp-1', summary: { changed: 2 }, changes: [{ status: 'modified', path: 'src/providers/provider.mjs' }], receiptSha256: '6'.repeat(64) },
      action: null,
      error: null,
    },
    events: [
      { id: 'event-read', missionId: 'mission-proofline-fixture', kind: 'file.read', title: 'Read provider registry', path: 'src/providers/provider-registry.mjs', createdAt: '2026-08-14T09:01:00Z', receiptSha256: '7'.repeat(64) },
      { id: 'event-test', missionId: 'mission-proofline-fixture', kind: 'test', title: 'Provider contract tests', status: 'passed', createdAt: '2026-08-14T09:02:00Z', receiptSha256: '8'.repeat(64) },
      { id: 'event-approval', missionId: 'mission-proofline-fixture', kind: 'approval', title: 'Independent evidence still required', status: 'waiting', createdAt: '2026-08-14T09:03:00Z', receiptSha256: '9'.repeat(64) },
    ],
  };
}

test('mission renderer already exposes the semantic substrate required by the Proofline cockpit', () => {
  const html = renderActivityView(fixtureState());
  for (const hook of ['mission-spotlight', 'execution-story', 'time-travel', 'activity-toolbar', 'activity-filament', 'activity-event']) {
    assert.match(html, new RegExp(`class=\\"[^\\"]*${hook}`), `missing semantic hook: ${hook}`);
  }
  assert.match(html, /Open review/);
  assert.match(html, /Open Studio/);
  assert.match(html, /Evidence receipt/);
  assert.match(html, /Checkpoint receipt/);
  assert.match(html, /Story receipt/);
});

test('style graph loads the dedicated Proofline architecture after generic surface rules and before responsive policy', async () => {
  const index = await readFile(indexUrl, 'utf8');
  const surfaces = index.indexOf("@import './pages/surfaces.css';");
  const proofline = index.indexOf("@import './pages/mission-proofline.css';");
  const responsive = index.indexOf("@import './responsive.css';");
  assert.ok(surfaces >= 0 && proofline > surfaces, 'Proofline must refine generic surface rules');
  assert.ok(responsive > proofline, 'global responsive policy must remain the final host authority');
});

test('Proofline architecture is structural, evidence-first and responsive rather than a cosmetic skin', async () => {
  const css = await readFile(prooflineUrl, 'utf8');
  assert.match(css, /\.activity-page\s*\{[^}]*display:\s*grid/s);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(/);
  assert.match(css, /\.mission-spotlight\s*\{[^}]*grid-area:\s*mission/s);
  assert.match(css, /\.execution-story\s*\{[^}]*grid-area:\s*story/s);
  assert.match(css, /\.time-travel\s*\{[^}]*grid-area:\s*recovery[^}]*position:\s*sticky/s);
  assert.match(css, /\.activity-filament\s*\{[^}]*grid-area:\s*proofline/s);
  assert.match(css, /\.activity-event__body\s+details/);
  assert.match(css, /\.activity-page:not\(:has\(\.mission-spotlight\)\)/);
  assert.match(css, /@media\s*\(max-width:\s*980px\)/);
  assert.match(css, /grid-template-columns:\s*minmax\(0,\s*1fr\)/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
});

test('flagship synthesis packet contains three materially divergent directions and an explicit selected architecture', async () => {
  const packet = await readFile(synthesisUrl, 'utf8');
  for (const heading of [
    'Direction A — Mission Control / Flight Deck',
    'Direction B — Spatial Agent Studio',
    'Direction C — Evidence-first Toolcraft',
    'Selected architecture — Proofline Mission Cockpit',
    'Critique cycle 1',
    'Critique cycle 2',
    'Generic-transfer resistance',
    'Responsive structural evidence',
  ]) assert.match(packet, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(packet, /719981b7a2cf0e8406672d20ce1840e7a26ef5b8/);
  assert.match(packet, /generator[^\n]*cannot[^\n]*VERIFIED/i);
});
