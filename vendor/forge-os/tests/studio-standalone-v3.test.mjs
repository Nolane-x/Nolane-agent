import test from 'node:test';
import assert from 'node:assert/strict';
import { renderForgeStudioHtml } from '../src/ui/forge-studio.mjs';

test('Forge Studio falls back to negotiated same-origin MCP when the host bridge is absent',()=>{
  const html=renderForgeStudioHtml({project:{id:'forge_standalone',name:'Standalone',stage:'intent',assurance:'A1',domain:'all',revision:1,semanticRevision:1,ideas:[],artifacts:[],evidence:[],gates:[],findings:[],risks:[],routes:[]}});
  assert.match(html,/notifications\/initialized/);
  assert.match(html,/MCP-Session-Id/i);
  assert.match(html,/fetch\('\/mcp'/);
  assert.doesNotMatch(html,/This host does not expose the MCP Apps bridge/);
  assert.match(html,/connect-src (?:'|&#39;)self(?:'|&#39;)/);
  assert.match(html,/img-src (?:'|&#39;)self(?:'|&#39;) data:/);
});
