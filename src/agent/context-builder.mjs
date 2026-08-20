import { PromptTierAssembler } from '../native-core/prompt-tier-assembler.mjs';
import { formatNuiEnvelopeForPrompt } from '../ui-intelligence/nui-host-sidecar.mjs';

const STABLE = ['system', 'skills'];
const WORKSPACE = ['code', 'artifacts', 'memory', 'references'];
const TURN = ['task', 'toolOutput'];

const itemsFor = (context, categories) => categories.flatMap((category) => (context[category] ?? []).map((item, index) => ({
  id: `${category}:${item.id ?? index + 1}`,
  text: `[${category}:${item.id ?? index + 1}]\n${item.text}`,
})));

export class ContextBuilder {
  constructor({ assembler = new PromptTierAssembler() } = {}) {
    if (!assembler?.assemble) throw new TypeError('ContextBuilder requires a prompt tier assembler');
    this.assembler = assembler;
  }

  build(contextPack, { task, toolInstructions = true, extraOmissions = [], secretValues = [], maxCharacters, nuiEnvelope = null } = {}) {
    if (!contextPack?.compiled?.context) throw new TypeError('compiled ContextPack is required');
    const context = contextPack.compiled.context;
    const stable = itemsFor(context, STABLE);
    if (nuiEnvelope) stable.push({ id: 'nui-host-envelope', text: formatNuiEnvelopeForPrompt(nuiEnvelope) });
    if (toolInstructions) stable.push({ id: 'execution-contract', text: '[execution-contract]\nPropose tools only through structured tool calls. A model statement is never proof of completion. Completion remains awaiting independent ForgeOS verification.' });
    const workspace = itemsFor(context, WORKSPACE);
    const turn = itemsFor(context, TURN);
    if (!turn.length) turn.push({ id: 'task:fallback', text: String(task?.objective ?? task ?? '') });
    const promptTiers = this.assembler.assemble({ stable, workspace, turn, secretValues, ...(maxCharacters ? { maxCharacters } : {}) });
    const systemContent = [promptTiers.tiers.stable.content, promptTiers.tiers.workspace.content].filter(Boolean).join('\n\n');
    const userContent = promptTiers.tiers.turn.content || String(task?.objective ?? task ?? '');
    return Object.freeze({
      messages: Object.freeze([
        Object.freeze({ role: 'system', content: systemContent }),
        Object.freeze({ role: 'user', content: userContent }),
      ]),
      omissions: Object.freeze([...(contextPack.compiled.omissions ?? []), ...(extraOmissions ?? []), ...promptTiers.omissions]),
      contextPackSha256: contextPack.contextPackSha256,
      promptTiers,
    });
  }
}
