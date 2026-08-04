import assert from 'node:assert/strict';
import test from 'node:test';

import { createRoutes } from '../src/server/routes.mjs';

async function call(route, pathname) {
  let status; let data = '';
  const req = { method: 'GET', async *[Symbol.asyncIterator]() {} };
  const res = { writeHead(code) { status = code; }, end(chunk = '') { data += chunk; } };
  await route(req, res, new URL(`http://local${pathname}`));
  return { status, body: JSON.parse(data) };
}

test('Execution Story HTTP API exposes level-specific story and expert export', async () => {
  const calls = [];
  const executionStory = {
    snapshot(input) { calls.push(['snapshot', input]); return { schema: 'nolane.execution-story.v1', input }; },
    exportBundle(input) { calls.push(['export', input]); return { schema: 'nolane.execution-story-export.v1', input }; },
  };
  const route = createRoutes({ executionStory });
  const story = await call(route, '/api/execution-story?missionId=m1&level=studio&language=vi&afterSeq=7&limit=80');
  assert.equal(story.status, 200);
  assert.equal(story.body.input.missionId, 'm1');
  assert.equal(story.body.input.level, 'studio');
  assert.equal(story.body.input.afterSeq, 7);
  const exported = await call(route, '/api/execution-story/export?missionId=m1&language=en');
  assert.equal(exported.body.schema, 'nolane.execution-story-export.v1');
  assert.equal(calls.length, 2);
});
