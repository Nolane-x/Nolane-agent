import { readFile, access } from 'node:fs/promises';
const tck = JSON.parse(await readFile('tck/platform-capabilities.json','utf8'));
const failures = [];
for (const adapter of tck.adapters) {
  for (const evidence of adapter.evidence) {
    try { await access(evidence); } catch { failures.push(`${adapter.id}: missing ${evidence}`); }
  }
}
for (const file of ['.mcp.json','.claude-plugin/plugin.json','adapters/generic/manifest.json']) {
  try { JSON.parse(await readFile(file,'utf8')); } catch (error) { failures.push(`${file}: ${error.message}`); }
}
if (failures.length) { console.error(failures.join('\n')); process.exitCode = 1; }
else console.log(`Validated ${tck.adapters.length} adapters and ${tck.capabilities.length} capabilities.`);
