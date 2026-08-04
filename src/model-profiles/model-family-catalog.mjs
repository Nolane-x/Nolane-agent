const codingDefaults = {
  capabilities: { coding: true, toolCalling: true, structuredOutput: true, streaming: true, fillInMiddle: null },
  toolCalling: { supported: true, parallel: null, strictSchema: null, toolChoice: null },
  quality: { coding: 3.8, debugging: 3.5, largeRefactor: 3.2, toolUse: 3.4 },
  specialties: ['coding', 'debugging'],
  taskEnvelope: { minimumClass: 'micro', maximumClass: 'large', recommendedClasses: ['small', 'medium'], verificationRequired: true },
};
const generalDefaults = {
  capabilities: { coding: true, reasoning: true, agentic: null, toolCalling: null, structuredOutput: null, streaming: true },
  quality: { coding: 3, reasoning: 3, instructionFollowing: 3 },
  taskEnvelope: { minimumClass: 'micro', maximumClass: 'medium', recommendedClasses: ['small'], verificationRequired: true },
};
const reasoningDefaults = {
  capabilities: { coding: true, reasoning: true, agentic: true, toolCalling: true, structuredOutput: true, streaming: true },
  toolCalling: { supported: true, parallel: null, strictSchema: null },
  reasoning: { supported: true, levels: ['low', 'medium', 'high'], controllable: null },
  quality: { coding: 4, reasoning: 4.4, debugging: 4, toolUse: 3.8 },
  specialties: ['reasoning', 'complex-debugging'],
  taskEnvelope: { minimumClass: 'small', maximumClass: 'frontier', recommendedClasses: ['large', 'frontier'], verificationRequired: true },
};

function template(id, pattern, defaults, extras = {}) {
  return { id, pattern, defaults, ...extras };
}

export const MODEL_FAMILY_TEMPLATES = [
  template('openai-gpt', /(?:^|\/)gpt[-_]/i, reasoningDefaults),
  template('openai-codex', /codex/i, { ...codingDefaults, quality: { coding: 4.7, debugging: 4.5, largeRefactor: 4.5, toolUse: 4.4 }, specialties: ['agentic-coding', 'large-refactor', 'repository-repair'] }),
  template('openai-o-series', /(?:^|\/)o[134](?:[-_.]|$)/i, reasoningDefaults),
  template('openai-gpt-oss', /gpt[-_]?oss/i, reasoningDefaults),
  template('anthropic-claude', /claude/i, reasoningDefaults),
  template('google-gemini', /gemini/i, reasoningDefaults),
  template('deepseek-v4', /deepseek[-_ ]?v4/i, reasoningDefaults),
  template('deepseek-v3', /deepseek[-_ ]?v3/i, reasoningDefaults),
  template('deepseek-r1', /deepseek[-_ ]?r1|deepseek[-_ ]?reasoner/i, reasoningDefaults),
  template('deepseek-coder', /deepseek.*coder/i, codingDefaults),
  template('moonshot-kimi-k3', /kimi[-_ ]?k3/i, reasoningDefaults),
  template('moonshot-kimi-k2', /kimi[-_ ]?k2/i, reasoningDefaults),
  template('qwen3-coder', /qwen3(?:\.\d+)?[-_ ]?coder/i, { ...codingDefaults, specialties: ['agentic-coding', 'repository-repair', 'tool-use'] }),
  template('qwen2.5-coder', /qwen2[._-]?5.*coder/i, codingDefaults),
  template('qwen-reasoning', /qwq|qwen.*thinking|qwen.*reason/i, reasoningDefaults),
  template('qwen-general', /qwen/i, generalDefaults),
  template('mistral-devstral', /devstral/i, { ...codingDefaults, specialties: ['agentic-coding', 'software-engineering'] }),
  template('mistral-codestral', /codestral/i, { ...codingDefaults, capabilities: { ...codingDefaults.capabilities, fillInMiddle: true }, specialties: ['code-completion', 'fill-in-middle'] }),
  template('mistral-mixtral', /mixtral/i, generalDefaults),
  template('mistral-general', /mistral|ministral/i, generalDefaults),
  template('meta-code-llama', /codellama|code[-_ ]?llama/i, codingDefaults),
  template('meta-llama', /llama/i, generalDefaults),
  template('google-codegemma', /codegemma/i, codingDefaults),
  template('google-gemma', /gemma/i, generalDefaults),
  template('microsoft-phi', /(?:^|\/)phi[-_]/i, generalDefaults),
  template('bigcode-starcoder', /starcoder/i, codingDefaults),
  template('ibm-granite-code', /granite.*code/i, codingDefaults),
  template('ibm-granite', /granite/i, generalDefaults),
  template('nvidia-nemotron', /nemotron/i, reasoningDefaults),
  template('zhipu-glm', /(?:^|\/)glm[-_]/i, reasoningDefaults),
  template('minimax', /minimax/i, reasoningDefaults),
  template('cohere-command', /command[-_]/i, reasoningDefaults),
  template('ai21-jamba', /jamba/i, generalDefaults),
  template('databricks-dbrx', /dbrx/i, generalDefaults),
  template('snowflake-arctic', /arctic/i, generalDefaults),
  template('01ai-yi', /(?:^|\/)yi[-_]/i, generalDefaults),
  template('tii-falcon', /falcon/i, generalDefaults),
  template('internlm', /internlm/i, generalDefaults),
  template('internvl', /internvl/i, generalDefaults),
  template('baichuan', /baichuan/i, generalDefaults),
  template('minicpm', /minicpm/i, generalDefaults),
  template('huggingface-smollm', /smollm/i, generalDefaults),
  template('allenai-olmo', /olmo/i, generalDefaults),
  template('stability-stablelm', /stablelm/i, generalDefaults),
  template('tinyllama', /tinyllama/i, generalDefaults),
  template('eleutherai-pythia', /pythia/i, generalDefaults),
  template('replit-code', /replit.*code/i, codingDefaults),
  template('deepcoder', /deepcoder/i, codingDefaults),
  template('magicoder', /magicoder/i, codingDefaults),
  template('wizardcoder', /wizardcoder/i, codingDefaults),
  template('opencoder', /opencoder/i, codingDefaults),
  template('poolside-laguna', /laguna/i, codingDefaults),
  template('thinking-machines-inkling', /inkling/i, reasoningDefaults),
  template('inclusion-ling', /(?:^|\/)ling[-_]/i, generalDefaults),
  template('xai-grok', /grok/i, reasoningDefaults),
  template('amazon-nova', /nova[-_]/i, generalDefaults),
  template('writer-palmyra', /palmyra/i, generalDefaults),
  template('openchat', /openchat/i, generalDefaults),
  template('solar', /solar/i, generalDefaults),
  template('exaone', /exaone/i, generalDefaults),
  template('aya', /(?:^|\/)aya[-_]/i, generalDefaults),
];

export const GENERIC_SIZE_TEMPLATES = [
  { id: 'sub-1b', max: 1e9, taskEnvelope: { maximumClass: 'micro', recommendedClasses: ['micro'], verificationRequired: true }, quality: { coding: 1.2, reasoning: 1.1 } },
  { id: '1b-2b', max: 2.5e9, taskEnvelope: { maximumClass: 'micro', recommendedClasses: ['micro'], verificationRequired: true }, quality: { coding: 1.6, reasoning: 1.5 } },
  { id: '3b-4b', max: 4.5e9, taskEnvelope: { maximumClass: 'small', recommendedClasses: ['micro', 'small'], verificationRequired: true }, quality: { coding: 2.1, reasoning: 2 } },
  { id: '5b-8b', max: 8.5e9, taskEnvelope: { maximumClass: 'small', recommendedClasses: ['small'], verificationRequired: true }, quality: { coding: 2.6, reasoning: 2.5 } },
  { id: '9b-14b', max: 14.5e9, taskEnvelope: { maximumClass: 'medium', recommendedClasses: ['small', 'medium'], verificationRequired: true }, quality: { coding: 3, reasoning: 2.9 } },
  { id: '15b-24b', max: 24.5e9, taskEnvelope: { maximumClass: 'medium', recommendedClasses: ['medium'], verificationRequired: true }, quality: { coding: 3.3, reasoning: 3.2 } },
  { id: '25b-35b', max: 35.5e9, taskEnvelope: { maximumClass: 'large', recommendedClasses: ['medium', 'large'], verificationRequired: true }, quality: { coding: 3.7, reasoning: 3.6 } },
  { id: '36b-72b', max: 72.5e9, taskEnvelope: { maximumClass: 'large', recommendedClasses: ['large'], verificationRequired: true }, quality: { coding: 4, reasoning: 3.9 } },
  { id: '73b-120b', max: 120.5e9, taskEnvelope: { maximumClass: 'frontier', recommendedClasses: ['large', 'frontier'], verificationRequired: true }, quality: { coding: 4.2, reasoning: 4.2 } },
  { id: '121b-250b', max: 250.5e9, taskEnvelope: { maximumClass: 'frontier', recommendedClasses: ['frontier'], verificationRequired: true }, quality: { coding: 4.3, reasoning: 4.4 } },
  { id: '251b-500b', max: 500.5e9, taskEnvelope: { maximumClass: 'frontier', recommendedClasses: ['frontier'], verificationRequired: true }, quality: { coding: 4.4, reasoning: 4.5 } },
  { id: '501b-1t', max: 1.05e12, taskEnvelope: { maximumClass: 'frontier', recommendedClasses: ['frontier'], verificationRequired: true }, quality: { coding: 4.5, reasoning: 4.6 } },
  { id: '1t-plus', max: Infinity, taskEnvelope: { maximumClass: 'frontier', recommendedClasses: ['frontier'], verificationRequired: true }, quality: { coding: 4.6, reasoning: 4.7 } },
];

export function matchFamilyTemplate(modelId) {
  return MODEL_FAMILY_TEMPLATES.find((entry) => entry.pattern.test(modelId)) ?? null;
}

export function matchSizeTemplate(parameterCount) {
  if (!Number.isFinite(parameterCount)) return null;
  return GENERIC_SIZE_TEMPLATES.find((entry) => parameterCount <= entry.max) ?? GENERIC_SIZE_TEMPLATES.at(-1);
}
