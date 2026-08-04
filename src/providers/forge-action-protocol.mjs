import { repairToolArguments } from '../agent/message-sanitization.mjs';

function roleMessage(message) {
  return `[${String(message?.role ?? 'user').toUpperCase()}]\n${typeof message?.content === 'string' ? message.content : JSON.stringify(message?.content ?? '')}`;
}

export function buildForgeActionPrompt(messages = [], tools = []) {
  const conversation = (messages ?? []).map(roleMessage).join('\n\n');
  if (!Array.isArray(tools) || !tools.length) return conversation;
  const bounded = tools.slice(0, 64).map((tool) => ({
    name: String(tool?.function?.name ?? ''),
    description: String(tool?.function?.description ?? '').slice(0, 300),
    parameters: tool?.function?.parameters ?? { type: 'object' },
  })).filter((tool) => tool.name);
  return `${conversation}\n\n[FORGE_ACTION_PROTOCOL]\nYou are a read-only reasoning worker inside Forge Studio. Never directly modify files or run side-effecting commands. Request actions only through this JSON envelope and output no markdown around it:\n{"text":"brief reasoning or final answer","toolCalls":[{"id":"unique-id","name":"one offered tool name","arguments":{}}]}\nAn empty toolCalls array means you are ready for independent verification. Offered tools:\n${JSON.stringify(bounded)}`;
}

export function parseForgeActionEnvelope(value, offeredTools = []) {
  const offeredNames = new Set((offeredTools ?? []).map((tool) => typeof tool === 'string' ? tool : String(tool?.function?.name ?? '')).filter(Boolean));
  const trimmed = String(value ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let parsed;
  try { parsed = JSON.parse(trimmed); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.toolCalls)) return null;
  const toolCalls = parsed.toolCalls.map((call, index) => {
    const name = String(call?.name ?? '').trim();
    if (!name) throw new TypeError('tool call name is required');
    if (!offeredNames.has(name)) throw new Error(`Provider requested an unavailable Forge tool: ${name}`);
    const args = typeof call.arguments === 'string' ? repairToolArguments(call.arguments) : structuredClone(call.arguments ?? {});
    const rawArguments = typeof call.arguments === 'string' ? call.arguments : JSON.stringify(args);
    return Object.freeze({ id: String(call.id ?? `call_${index + 1}`), name, arguments: args, rawArguments });
  });
  return Object.freeze({ text: typeof parsed.text === 'string' ? parsed.text : '', toolCalls: Object.freeze(toolCalls) });
}
