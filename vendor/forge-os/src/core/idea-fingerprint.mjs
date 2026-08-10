import { canonicalSha256 } from './canonical-json.mjs';

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','in','into','is','it','of','on','or','that','the','their','then','this','to','too','using','with',
  'cua','va','la','cho','trong','mot','nhung','cac','tu','voi','nay','do','duoc','giup',
]);

const CONCEPTS = Object.freeze([
  ['creator', /\b(?:creator|creators|publisher|publishers|nguoi sang tao)\b/giu],
  ['highlight', /\b(?:highlight|highlights|important moments?|key moments?|best moments?|khoanh khac noi bat)\b/giu],
  ['clip', /\b(?:shorts?|short clips?|clips?|vertical videos?|video ngan)\b/giu],
  ['video', /\b(?:long[- ]form media|long videos?|recordings?|videos?|video dai)\b/giu],
  ['automate', /\b(?:ai|automatic|automatically|automated|automation|tu dong)\b/giu],
  ['extract', /\b(?:divide|divides|split|splits|find|finds|finding|detect|detects|extract|extracts|create|creates|generate|generates|tach|tim|phat hien|tao)\b/giu],
  ['time-cost', /\b(?:lose time|takes? .*? time|time consuming|slow|mat thoi gian|ton thoi gian)\b/giu],
]);

function normalizedText(value) {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9\p{L}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function stem(token) {
  if (token.length > 5 && token.endsWith('ing')) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith('ers')) return token.slice(0, -1);
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && token.endsWith('ed')) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s')) return token.slice(0, -1);
  return token;
}

export function semanticTokens(value) {
  const source = normalizedText(value);
  const tokens = new Set();
  for (const [concept, pattern] of CONCEPTS) {
    pattern.lastIndex = 0;
    if (pattern.test(source)) tokens.add(`concept:${concept}`);
  }
  for (const raw of source.split(' ')) {
    const token = stem(raw);
    if (token.length >= 3 && !STOPWORDS.has(token)) tokens.add(token);
  }
  return tokens;
}

function jaccard(left, right) {
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  for (const item of left) if (right.has(item)) intersection += 1;
  return intersection / (left.size + right.size - intersection || 1);
}

export function ideaContent(value) {
  const fields = ['id','title','thesis','targetUser','hiddenProblem','mechanism','interface','valueModel','distribution','assumptions','closestPattern','differences','cheapestExperiment','failureModes'];
  return Object.fromEntries(fields.map((field) => [field, structuredClone(value[field]) ]));
}

export function ideaContentSha256(idea) {
  return canonicalSha256(ideaContent(idea));
}

export function mechanismFingerprint(idea) {
  const tokens = [
    ...semanticTokens(idea.targetUser),
    ...semanticTokens(idea.hiddenProblem),
    ...semanticTokens(idea.mechanism),
    ...semanticTokens(idea.interface),
    ...semanticTokens(idea.valueModel),
    ...semanticTokens(idea.distribution),
  ];
  return canonicalSha256([...new Set(tokens)].sort());
}

export function ideaSimilarity(left, right) {
  const dimensions = [
    ['mechanism', 0.45],
    ['hiddenProblem', 0.25],
    ['targetUser', 0.10],
    ['interface', 0.08],
    ['valueModel', 0.06],
    ['distribution', 0.06],
  ];
  return dimensions.reduce((score, [field, weight]) => score + jaccard(semanticTokens(left[field]), semanticTokens(right[field])) * weight, 0);
}
