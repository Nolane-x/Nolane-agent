const KNOWN_FAMILIES = [
  ['qwen3-coder', /qwen3(?:\.\d+)?[-_ ]?coder/],
  ['qwen2.5-coder', /qwen2[._-]?5[-_ ]?coder/],
  ['qwen-coder', /qwen.*coder/],
  ['deepseek-v4', /deepseek[-_ ]?v4/],
  ['deepseek-v3', /deepseek[-_ ]?v3/],
  ['deepseek-r1', /deepseek[-_ ]?r1|deepseek[-_ ]?reasoner/],
  ['deepseek-coder', /deepseek[-_ ]?coder/],
  ['claude', /claude/], ['gpt-codex', /gpt.*codex|codex/], ['gpt', /\bgpt[-_]/],
  ['gemini', /gemini/], ['kimi-k3', /kimi[-_ ]?k3/], ['kimi-k2', /kimi[-_ ]?k2/],
  ['devstral', /devstral/], ['codestral', /codestral/], ['mistral', /mistral|ministral|mixtral/],
  ['gemma', /gemma/], ['llama', /llama/], ['phi', /(?:^|[\/-])phi[-_]/],
  ['starcoder', /starcoder/], ['code-llama', /codellama|code[-_ ]?llama/],
  ['granite', /granite/], ['nemotron', /nemotron/], ['glm', /glm[-_]/],
  ['minimax', /minimax/], ['command', /command[-_ ]?[rra]?/], ['jamba', /jamba/],
  ['internlm', /internlm/], ['internvl', /internvl/], ['smollm', /smollm/],
  ['olmo', /olmo/], ['falcon', /falcon/], ['yi', /(?:^|[\/-])yi[-_]/],
];

function normalizeQuantization(raw) {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (/^Q\d(?:_[A-Z0-9]+)*$/.test(upper)) return upper;
  if (/^(?:FP|BF)\d+$/.test(upper)) return upper.toLowerCase();
  if (/^(?:INT|NF)\d+$/.test(upper)) return upper.toLowerCase();
  return raw.toLowerCase();
}

function detectQuantization(raw) {
  const patterns = [
    /(?:[:._-])(Q[2-8](?:_[A-Z0-9]+)*)\b/i,
    /(?:^|[-_.])(FP4|FP6|FP8|FP16|FP32|BF16|INT2|INT3|INT4|INT8|NF4)(?:$|[-_.])/i,
    /(?:^|[-_.])((?:2|3|4|5|6|8)bit)(?:$|[-_.])/i,
    /(?:^|[-_.])(AWQ|GPTQ|EXL2|EXL3)(?:$|[-_.])/i,
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return normalizeQuantization(match[1]);
  }
  return null;
}

function detectParameters(raw) {
  const matches = [...raw.matchAll(/(?:^|[-_\/ ])(\d+(?:\.\d+)?)\s*[bB](?:[-_]?A(\d+(?:\.\d+)?)\s*[bB])?(?=$|[-_\/.: ])/gi)];
  if (!matches.length) return { total: null, active: null, scale: null };
  const match = matches.at(-1);
  const totalNumber = Number(match[1]);
  const activeNumber = match[2] ? Number(match[2]) : null;
  return {
    total: Math.round(totalNumber * 1e9),
    active: activeNumber == null ? null : Math.round(activeNumber * 1e9),
    scale: `${match[1]}B${match[2] ? `-A${match[2]}B` : ''}`,
  };
}

function detectSeries(normalized) {
  const patterns = [
    /\b(qwen\d+(?:\.\d+)?)\b/, /\b(deepseek-v\d+)\b/, /\b(deepseek-r\d+)\b/,
    /\b(gemma-?\d+(?:\.\d+)?)\b/, /\b(llama-?\d+(?:\.\d+)?)\b/,
    /\b(gemini-?\d+(?:\.\d+)?)\b/, /\b(gpt-?\d+(?:\.\d+)?)\b/,
    /\b(phi-?\d+(?:\.\d+)?)\b/, /\b(glm-?\d+(?:\.\d+)?)\b/,
    /\b(kimi-k\d+(?:\.\d+)?)\b/, /\b(claude-(?:opus|sonnet|haiku)-?\d+(?:\.\d+)?)\b/,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match) return match[1].replace(/^(qwen)(\d)/, '$1$2');
  }
  return null;
}

export function inferModelIdentity(id) {
  const rawId = String(id ?? '').trim();
  const normalizedId = rawId.toLowerCase();
  const publisherSegment = normalizedId.includes('/') ? normalizedId.split('/')[0] : null;
  let publisher = publisherSegment;
  if (publisher === 'mlx-community') publisher = 'mlx-community';
  if (!publisher) {
    if (normalizedId.includes('openai') || /\bgpt-|\bcodex/.test(normalizedId)) publisher = 'openai';
    else if (normalizedId.includes('claude')) publisher = 'anthropic';
    else if (normalizedId.includes('gemini') || normalizedId.includes('gemma')) publisher = 'google';
    else if (normalizedId.includes('deepseek')) publisher = 'deepseek';
    else if (normalizedId.includes('qwen')) publisher = 'qwen';
    else if (normalizedId.includes('kimi')) publisher = 'moonshotai';
  }
  const family = KNOWN_FAMILIES.find(([, pattern]) => pattern.test(normalizedId))?.[0] ?? null;
  const { total, active, scale } = detectParameters(rawId);
  const format = /(?:^|[-_.:])gguf(?:$|[-_.:])|\.gguf$/i.test(rawId) ? 'gguf'
    : /(?:^|[-_.])safetensors?(?:$|[-_.])/i.test(rawId) ? 'safetensors'
      : /(?:^|[-_.])onnx(?:$|[-_.])/i.test(rawId) ? 'onnx' : null;
  const runtime = /mlx-community|(?:^|[-_.])mlx(?:$|[-_.])/i.test(rawId) ? 'mlx'
    : /ollama[:/]/i.test(rawId) ? 'ollama'
      : /(?:^|[-_.])vllm(?:$|[-_.])/i.test(rawId) ? 'vllm' : null;
  const quantization = detectQuantization(rawId);
  const instructionTuned = /(?:^|[-_.])(instruct|instruction|chat|it)(?:$|[-_.:])/i.test(rawId);
  const codingSpecialized = /coder|codestral|devstral|starcoder|code[-_ ]?llama|deepcoder|magicoder|wizardcoder|opencoder|code-model/i.test(rawId);
  const reasoningSpecialized = /reason|thinking|thinker|deepseek[-_ ]?r\d|qwq|o[134](?:[-_.]|$)/i.test(rawId);
  const architectureType = active != null || /mixtral|moe|a\d+(?:\.\d+)?b/i.test(rawId) ? 'moe' : total != null ? 'dense' : null;
  return {
    rawId, normalizedId, publisher, family, series: detectSeries(normalizedId),
    parameterCount: total, activeParameterCount: active,
    architectureType, parameterScale: scale,
    format, quantization, runtime,
    instructionTuned, codingSpecialized, reasoningSpecialized,
  };
}
