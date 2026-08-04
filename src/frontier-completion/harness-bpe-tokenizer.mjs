import { createHash } from 'node:crypto';

const canonical = (value) => JSON.stringify(value, Object.keys(value).sort());
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function required(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${label} is required`);
  return text;
}

export class HarnessBpeTokenizer {
  constructor({ modelId, vocab = [], merges = [], normalization = 'NFC' } = {}) {
    this.modelId = required(modelId, 'modelId');
    this.normalization = normalization;
    this.vocab = new Set(vocab.map(String));
    this.mergeRanks = new Map();
    merges.map(String).forEach((entry, index) => {
      const [left, right, ...extra] = entry.trim().split(/\s+/);
      if (!left || !right || extra.length) throw new TypeError(`invalid BPE merge: ${entry}`);
      this.mergeRanks.set(`${left}\u0000${right}`, index);
    });
    const pack = { schema: 'forge.harness-bpe-tokenizer.v1', modelId: this.modelId, normalization, vocab: [...this.vocab], merges: [...merges].map(String) };
    this.receiptSha256 = sha256(JSON.stringify(pack));
    Object.freeze(this);
  }

  tokenize(text, { signal } = {}) {
    if (signal?.aborted) throw signal.reason ?? new Error('tokenization aborted');
    const words = String(text ?? '').normalize(this.normalization).match(/\S+/gu) ?? [];
    const output = [];
    for (const word of words) {
      let symbols = [...word];
      while (symbols.length > 1) {
        let bestIndex = -1; let bestRank = Number.POSITIVE_INFINITY;
        for (let index = 0; index < symbols.length - 1; index += 1) {
          const rank = this.mergeRanks.get(`${symbols[index]}\u0000${symbols[index + 1]}`);
          if (rank != null && rank < bestRank) { bestRank = rank; bestIndex = index; }
        }
        if (bestIndex < 0) break;
        symbols.splice(bestIndex, 2, `${symbols[bestIndex]}${symbols[bestIndex + 1]}`);
      }
      for (const symbol of symbols) output.push(this.vocab.has(symbol) ? symbol : '<unk>');
    }
    return Object.freeze(output);
  }

  async count(text, options = {}) { return this.tokenize(text, options).length; }
  async countBatch(texts, options = {}) {
    if (!Array.isArray(texts)) throw new TypeError('texts must be an array');
    return Promise.all(texts.map((text) => this.count(text, options)));
  }
}
