let buffer = Buffer.alloc(0);
function send(message) {
  const payload = Buffer.from(JSON.stringify(message));
  process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
  process.stdout.write(payload);
}
function respond(id, result) { send({ jsonrpc: '2.0', id, result }); }
function handle(message) {
  if (message.method === 'initialize') return respond(message.id, { capabilities: { workspaceSymbolProvider: true, definitionProvider: true, referencesProvider: true, documentSymbolProvider: true, callHierarchyProvider: true, hoverProvider: true, renameProvider: true, typeDefinitionProvider: true } });
  if (message.method === 'workspace/symbol') return respond(message.id, [{ name: 'add', kind: 12, location: { uri: 'file:///workspace/src/math.ts', range: { start: { line: 0, character: 16 }, end: { line: 0, character: 19 } } } }]);
  if (message.method === 'textDocument/definition') return respond(message.id, { uri: 'file:///workspace/src/math.ts', range: { start: { line: 0, character: 16 }, end: { line: 0, character: 19 } } });
  if (message.method === 'textDocument/references') return respond(message.id, [
    { uri: 'file:///workspace/src/math.ts', range: { start: { line: 0, character: 16 }, end: { line: 0, character: 19 } } },
    { uri: 'file:///workspace/tests/math.test.ts', range: { start: { line: 2, character: 7 }, end: { line: 2, character: 10 } } },
  ]);
  if (message.method === 'textDocument/hover') return respond(message.id, { contents: { kind: 'markdown', value: '`add(a, b)` adds two values' } });
  if (message.method === 'textDocument/rename') return respond(message.id, { changes: { [message.params.textDocument.uri]: [{ range: { start: { line: 0, character: 16 }, end: { line: 0, character: 19 } }, newText: message.params.newName }] } });
  if (message.method === 'textDocument/typeDefinition') return respond(message.id, { uri: 'file:///workspace/src/types.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } } });
  if (message.method === 'textDocument/documentSymbol') return respond(message.id, [{ name: 'add', kind: 12, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 42 } }, selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 19 } } }]);
  if (message.method === 'textDocument/prepareCallHierarchy') return respond(message.id, [{ name: 'add', kind: 12, uri: 'file:///workspace/src/math.ts', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 42 } }, selectionRange: { start: { line: 0, character: 16 }, end: { line: 0, character: 19 } } }]);
  if (message.method === 'callHierarchy/incomingCalls') return respond(message.id, [{ from: { name: 'test add', kind: 12, uri: 'file:///workspace/tests/math.test.ts', range: { start: { line: 1, character: 0 }, end: { line: 4, character: 1 } }, selectionRange: { start: { line: 1, character: 9 }, end: { line: 1, character: 17 } } }, fromRanges: [] }]);
  if (message.method === 'callHierarchy/outgoingCalls') return respond(message.id, []);
  if (message.method === 'shutdown') return respond(message.id, null);
  if (message.method === 'forge/slow') return setTimeout(() => respond(message.id, { late: true }), 500);
  if (message.method === 'textDocument/didOpen') send({ jsonrpc: '2.0', method: 'textDocument/publishDiagnostics', params: { uri: message.params.textDocument.uri, diagnostics: [{ severity: 2, message: 'Example warning', range: { start: { line: 0, character: 0 }, end: { line: 0, character: 3 } } }] } });
  if (message.id !== undefined) respond(message.id, null);
  if (message.method === 'exit') process.exit(0);
}
process.stdin.on('data', (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd < 0) return;
    const header = buffer.subarray(0, headerEnd).toString('ascii');
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) process.exit(2);
    const length = Number(match[1]);
    if (buffer.length < headerEnd + 4 + length) return;
    const payload = buffer.subarray(headerEnd + 4, headerEnd + 4 + length);
    buffer = buffer.subarray(headerEnd + 4 + length);
    handle(JSON.parse(payload.toString('utf8')));
  }
});
