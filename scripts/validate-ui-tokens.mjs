#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function walk(root, current = root) { const out = []; for (const entry of await readdir(current, { withFileTypes: true })) { const full = path.join(current, entry.name); if (entry.isDirectory()) out.push(...await walk(root, full)); else if (entry.isFile() && entry.name.endsWith('.css')) out.push(full); } return out.sort(); }
const tokenDecl = /(--[a-z0-9-]+)\s*:\s*([^;}{]+)/gi; const tokenUse = /var\(\s*(--[a-z0-9-]+)/gi; const rawColor = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(/gi;

function detectCycles(graph) { const cycles = []; const visiting = new Set(); const visited = new Set(); const stack = [];
  function visit(node) { if (visiting.has(node)) { const index = stack.indexOf(node); cycles.push(stack.slice(index).concat(node)); return; } if (visited.has(node)) return; visiting.add(node); stack.push(node); for (const next of graph.get(node) ?? []) visit(next); stack.pop(); visiting.delete(node); visited.add(node); }
  for (const node of graph.keys()) visit(node); return cycles;
}

export async function validateUiTokens({ root = 'ui-v3/styles' } = {}) {
  const absolute = path.resolve(root); const files = await walk(absolute); const definitions = new Map(); const usages = []; const rawColorsOutsidePrimitives = []; const layers = { primitive: 0, semantic: 0, component: 0 };
  for (const file of files) { const relative = path.relative(absolute, file).replaceAll('\\', '/'); const content = await readFile(file, 'utf8'); let match;
    while ((match = tokenDecl.exec(content))) { definitions.set(match[1], { value: match[2].trim(), file: relative }); if (relative.includes('/tokens/primitive.css') || relative === 'tokens/primitive.css') layers.primitive++; else if (relative.includes('/tokens/semantic.css') || relative === 'tokens/semantic.css') layers.semantic++; else if (relative.includes('/tokens/component.css') || relative === 'tokens/component.css') layers.component++; }
    while ((match = tokenUse.exec(content))) usages.push({ token: match[1], file: relative });
    if (!(relative.includes('/tokens/primitive.css') || relative === 'tokens/primitive.css')) { while ((match = rawColor.exec(content))) rawColorsOutsidePrimitives.push(`${relative}:${match[0]}`); }
  }
  const graph = new Map(); for (const [name, definition] of definitions) { graph.set(name, [...definition.value.matchAll(tokenUse)].map((match) => match[1])); }
  return Object.freeze({ files: files.length, layers: Object.freeze(layers), undefinedVariables: Object.freeze([...new Set(usages.filter((item) => !definitions.has(item.token)).map((item) => `${item.token}@${item.file}`))].sort()), cycles: Object.freeze(detectCycles(graph).map((cycle) => cycle.join(' -> '))), rawColorsOutsidePrimitives: Object.freeze(rawColorsOutsidePrimitives.sort()) });
}

const rgb = (hex) => { const raw = hex.replace('#', ''); const full = raw.length === 3 ? raw.split('').map((x) => x + x).join('') : raw.slice(0, 6); return [0,2,4].map((offset) => Number.parseInt(full.slice(offset, offset + 2), 16) / 255); };
const luminance = (hex) => rgb(hex).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
export function contrastRatio(foreground, background) { const a = luminance(foreground); const b = luminance(background); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) validateUiTokens().then((report) => { console.log(JSON.stringify(report, null, 2)); if (report.undefinedVariables.length || report.cycles.length || report.rawColorsOutsidePrimitives.length) process.exitCode = 1; }).catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
