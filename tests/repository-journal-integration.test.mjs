import assert from 'node:assert/strict';
import test from 'node:test';

import { IncrementalIntelligenceJournal } from '../src/repository/incremental-intelligence-journal.mjs';
import { RepositoryIntelligenceScheduler } from '../src/repository/repository-intelligence-scheduler.mjs';

const governor = { snapshot: () => ({ state: 'normal', policy: { semanticIndexing: 'incremental' } }) };

test('RepositoryIntelligenceScheduler publishes normalized changes into the shared journal', async () => {
  const journal = new IncrementalIntelligenceJournal();
  const scheduler = new RepositoryIntelligenceScheduler({ governor, journal, runners: { lexical: async (_project, context) => ({ journalCursors: context.journalCursors }) } });
  const result = await scheduler.enqueue({
    project: { id: 'p1', workspaceRoot: '/tmp/p1' }, generation: 'g2', stages: ['lexical'],
    changes: [
      { path: 'src/a.mjs', contentHash: 'hash-a', kind: 'modify' },
      { path: './src/a.mjs', contentHash: 'hash-a', kind: 'modify' },
      { path: 'src/b.mjs', contentHash: 'hash-b', kind: 'create' },
    ],
  });
  assert.equal(result.journalCursors.length, 2);
  assert.deepEqual(result.outputs.lexical.journalCursors, result.journalCursors);
  assert.equal(journal.readBatch({ consumerId: 'semantic', projectId: 'p1' }).items.length, 2);
  scheduler.close();
});
