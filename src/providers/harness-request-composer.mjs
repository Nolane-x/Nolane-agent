import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';

const FAILURE_GUIDANCE = Object.freeze({
  'provider-timeout': 'The prior provider request timed out. Reduce repeated context, choose the smallest next action, and avoid long speculative chains.',
  'provider-rate-limit': 'The provider rate limit was reached. Do not duplicate the previous request; continue only with the smallest evidence-backed action.',
  'provider-overloaded': 'The provider was overloaded. Keep the retry compact and preserve the current verified state.',
  'context-overflow': 'The prior request exceeded context. Retain task, constraints, current hypothesis, and highest-value evidence only.',
  'malformed-tool-call': 'The prior tool call was malformed. Use one offered tool name and arguments that exactly match its JSON schema.',
  'unavailable-tool': 'The prior tool was unavailable. Select only from the currently offered tools and do not invent capabilities.',
  'sandbox-denied': 'The prior action crossed a sandbox boundary. Stay inside authorized paths and capabilities; choose a bounded alternative rather than repeating the denied action.',
  'patch-conflict': 'The prior patch conflicted with current content. Re-read the exact target range and produce a smaller patch with fresh preconditions.',
  'test-regression': 'The prior change caused a test regression. Re-evaluate the hypothesis, inspect the failing evidence, and prefer the smallest reversible correction.',
  'loop-no-progress': 'The previous actions made no measurable progress. Change the hypothesis or gather new evidence instead of repeating the same action.',
  unknown: 'The prior request failed. Use the classified error constraints, gather fresh evidence, and avoid repeating the same action unchanged.',
});

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function cloneMessages(messages) {
  if (!Array.isArray(messages)) throw new TypeError('messages must be an array');
  return messages.map((item) => ({ ...structuredClone(item), role: String(item?.role ?? 'user'), content: typeof item?.content === 'string' ? item.content : JSON.stringify(item?.content ?? '') }));
}

function cloneTools(tools) {
  if (!Array.isArray(tools)) throw new TypeError('tools must be an array');
  return tools.map((tool) => structuredClone(tool));
}

function weight(name, strategy, index) {
  const value = String(name ?? '');
  const patch = /^fs\.(?:patch|patchSet|write|rename|delete|mkdir|rmdir)$/.test(value);
  const read = /^fs\.(?:read|readMany|search)$/.test(value) || /(?:search|read|inspect|diagnostic|lsp|graph)/i.test(value);
  if (strategy === 'patch-first') return patch ? 0 : read ? 1 : /^process\./.test(value) ? 2 : 3 + index / 1000;
  if (strategy === 'read-first') return read ? 0 : patch ? 1 : /^process\./.test(value) ? 2 : 3 + index / 1000;
  if (strategy === 'concise') return read ? 0 : /^process\./.test(value) ? 1 : patch ? 2 : 3 + index / 1000;
  return index;
}

function composedSystem(profile, failure, task) {
  const directives = profile.systemDirectives.join('\n- ');
  const taskKind = String(task?.metadata?.taskKind ?? task?.role ?? 'general').slice(0, 80);
  const blocks = [
    `[harness-profile:${profile.id}@${profile.revision}]`,
    `Provider-specific public execution guidance:\n- ${directives}`,
    `Context strategy: ${profile.contextStrategy}. Tool strategy: ${profile.toolStrategy}. Patch strategy: ${profile.patchStrategy}. Task kind: ${taskKind}.`,
  ];
  if (failure?.class) blocks.push(`[harness-recovery:${String(failure.class).slice(0, 80)}]\n${FAILURE_GUIDANCE[failure.class] ?? FAILURE_GUIDANCE.unknown}`);
  return blocks.join('\n');
}

export class HarnessRequestComposer {
  constructor({ registry } = {}) {
    if (!registry?.resolve) throw new TypeError('HarnessRequestComposer registry is required');
    this.registry = registry;
  }

  compose({ provider = {}, messages = [], tools = [], task = {}, failure = null } = {}) {
    const profile = this.registry.resolve(provider);
    const nextMessages = cloneMessages(messages);
    const guidance = composedSystem(profile, failure, task);
    const systemIndex = nextMessages.findIndex((item) => item.role === 'system' || item.role === 'developer');
    if (systemIndex >= 0) nextMessages[systemIndex] = { ...nextMessages[systemIndex], content: `${nextMessages[systemIndex].content}\n\n${guidance}` };
    else nextMessages.unshift({ role: 'system', content: guidance });

    const nextTools = cloneTools(tools)
      .map((tool, index) => ({ tool, index, score: weight(tool?.function?.name, profile.toolStrategy, index) }))
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .slice(0, profile.maxToolSchemas)
      .map(({ tool }) => tool);

    const base = {
      schema: 'forge.harness-request-composition.v1',
      providerId: String(provider?.id ?? 'unknown').slice(0, 120),
      harnessFamily: String(provider?.harnessFamily ?? profile.family).slice(0, 80),
      profileId: profile.id,
      profileRevision: profile.revision,
      profileSha256: profile.profileSha256,
      taskKind: String(task?.metadata?.taskKind ?? task?.role ?? 'general').slice(0, 80),
      failureClass: failure?.class ? String(failure.class).slice(0, 80) : null,
      messageSha256: nextMessages.map((item) => canonicalSha256({ role: item.role, content: item.content })),
      toolNames: nextTools.map((tool) => String(tool?.function?.name ?? '')).filter(Boolean),
    };
    return deepFreeze({
      messages: nextMessages,
      tools: nextTools,
      profileId: profile.id,
      profileRevision: profile.revision,
      profileSha256: profile.profileSha256,
      harnessFamily: profile.family,
      receiptSha256: canonicalSha256(base),
    });
  }
}
