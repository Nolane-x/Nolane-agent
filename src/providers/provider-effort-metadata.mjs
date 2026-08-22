const LEVEL = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const EFFORTS_BY_KIND = Object.freeze({
  'openai-responses': Object.freeze(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']),
  'anthropic-messages': Object.freeze(['low', 'medium', 'high', 'xhigh', 'max']),
  'gemini-generate-content': Object.freeze(['minimal', 'low', 'medium', 'high']),
});

function providerView(provider) {
  return typeof provider?.publicView === 'function' ? provider.publicView() : provider;
}

export function effortTransportForKind(kind) {
  const levels = EFFORTS_BY_KIND[String(kind ?? '').trim()];
  return levels ? Object.freeze({ supported: true, mode: 'forwarded', levels }) : null;
}

export function providerDeclaredEffort(provider) {
  const view = providerView(provider);
  const transport = view?.effort ?? effortTransportForKind(view?.kind);
  if (transport?.supported !== true) return null;
  const levels = [...new Set((Array.isArray(transport.levels) ? transport.levels : [])
    .map((level) => String(level ?? '').trim().toLowerCase())
    .filter((level) => LEVEL.test(level)))];
  if (!levels.length) return null;
  return Object.freeze({
    reasoning: Object.freeze({ supported: true, controllable: true, levels: Object.freeze(levels) }),
    metadata: Object.freeze({
      effort: Object.freeze({
        provenance: 'provider-declared',
        transport: transport.mode === 'config-override' ? 'config-override' : 'forwarded',
        modelCompatibility: 'provider-validated-at-execution',
      }),
    }),
  });
}

export function withProviderDeclaredEffort(model, provider) {
  const declared = providerDeclaredEffort(provider);
  if (!declared || (model?.reasoning?.controllable === true && Array.isArray(model.reasoning.levels) && model.reasoning.levels.length)) return model;
  return Object.freeze({ ...model, reasoning: declared.reasoning, metadata: Object.freeze({ ...(model?.metadata ?? {}), ...declared.metadata }) });
}
