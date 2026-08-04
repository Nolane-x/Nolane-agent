import { createHash } from 'node:crypto';

const ORDER = Object.freeze(['stable', 'workspace', 'turn']);
const INJECTION_PATTERNS = Object.freeze([
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /reveal\s+(the\s+)?system\s+prompt/i,
  /exfiltrat(e|ion).*credential/i,
  /disable\s+(the\s+)?safety/i,
  /act\s+as\s+(an?\s+)?unrestricted/i,
]);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
};
const freeze = (value) => {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === 'object') return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, freeze(entry)])));
  return value;
};
const normalizeItems = (items, tier) => (items ?? []).map((item, index) => ({
  id: String(item?.id ?? `${tier}-${index + 1}`),
  text: String(item?.text ?? item ?? ''),
})).filter((item) => item.text.trim());

function redact(text, secretValues) {
  let output = String(text);
  for (const secret of secretValues) {
    const value = String(secret ?? '');
    if (value) output = output.split(value).join('[REDACTED_SECRET]');
  }
  return output;
}

export class PromptTierAssembler {
  constructor({ maxCharacters = 200_000, injectionPatterns = INJECTION_PATTERNS } = {}) {
    if (!Number.isInteger(maxCharacters) || maxCharacters < 64) throw new TypeError('maxCharacters must be an integer >= 64');
    this.maxCharacters = maxCharacters;
    this.injectionPatterns = [...injectionPatterns];
  }

  assemble({ stable = [], workspace = [], turn = [], secretValues = [], maxCharacters = this.maxCharacters } = {}) {
    if (!Number.isInteger(maxCharacters) || maxCharacters < 64) throw new TypeError('maxCharacters must be an integer >= 64');
    const accepted = { stable: [], workspace: [], turn: [] };
    const omissions = [];
    let used = 0;

    for (const tier of ORDER) {
      for (const item of normalizeItems({ stable, workspace, turn }[tier], tier)) {
        if (this.injectionPatterns.some((pattern) => pattern.test(item.text))) {
          omissions.push({ tier, id: item.id, reason: 'prompt-injection-quarantine', sourceSha256: sha256(item.text) });
          continue;
        }
        const safeText = redact(item.text, secretValues);
        const block = `[${tier}:${item.id}]\n${safeText}`;
        const separatorLength = used === 0 ? 0 : 2;
        const remaining = maxCharacters - used - separatorLength;
        if (remaining <= 0) {
          omissions.push({ tier, id: item.id, reason: 'character-budget', sourceSha256: sha256(item.text) });
          continue;
        }
        if (block.length > remaining) {
          const prefix = `[${tier}:${item.id}]\n`;
          const availableText = Math.max(0, remaining - prefix.length - 1);
          if (availableText > 0) {
            accepted[tier].push({ id: item.id, text: `${safeText.slice(0, availableText)}…`, truncated: true });
            used += separatorLength + prefix.length + availableText + 1;
          }
          omissions.push({ tier, id: item.id, reason: 'character-budget', sourceSha256: sha256(item.text) });
          continue;
        }
        accepted[tier].push({ id: item.id, text: safeText, truncated: false });
        used += separatorLength + block.length;
      }
    }

    const tiers = Object.fromEntries(ORDER.map((tier) => {
      const content = accepted[tier].map((item) => `[${tier}:${item.id}]\n${item.text}`).join('\n\n');
      return [tier, freeze({ content, characterCount: content.length, itemCount: accepted[tier].length, sha256: sha256(JSON.stringify(canonical({ tier, items: accepted[tier] }))) })];
    }));
    const content = ORDER.map((tier) => tiers[tier].content).filter(Boolean).join('\n\n');
    const lineageBase = { schema: 'nolane.native-core.prompt-tiers.v1', order: ORDER, tierHashes: Object.fromEntries(ORDER.map((tier) => [tier, tiers[tier].sha256])), omissions };
    return freeze({
      ...lineageBase,
      tiers,
      content,
      characterCount: content.length,
      omissions,
      lineageSha256: sha256(JSON.stringify(canonical(lineageBase))),
    });
  }
}
