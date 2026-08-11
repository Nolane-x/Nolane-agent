import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerminalClient } from '../ui-v3/views/workroom/terminal-client.mjs';

test('terminal client preserves the authenticated local session and resolves protocol replies', async () => {
  const sockets = [];
  class FakeSocket {
    constructor(url) { this.url = url; sockets.push(this); queueMicrotask(() => this.onopen?.()); }
    send(raw) {
      const request = JSON.parse(raw);
      queueMicrotask(() => this.onmessage?.({ data: JSON.stringify({ id: request.id, result: { id: 'terminal-1', shell: request.shell } }) }));
    }
    close() { this.onclose?.(); }
  }
  const client = createTerminalClient({
    WebSocketImpl: FakeSocket,
    locationObject: { protocol: 'http:', host: '127.0.0.1:4187', href: 'http://127.0.0.1:4187/?token=local-token' },
    clientId: 'workroom-client',
  });

  const terminal = await client.request('create', { projectId: 'p1', shell: 'pwsh', cwd: '.' });
  assert.deepEqual(terminal, { id: 'terminal-1', shell: 'pwsh' });
  assert.match(sockets[0].url, /\/terminal\?token=local-token&clientId=workroom-client/);
  client.close();
});
