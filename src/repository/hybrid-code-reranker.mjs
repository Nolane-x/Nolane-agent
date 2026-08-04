const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, Number(value) || 0));

function stable(candidate) {
  return `${String(candidate.path ?? '')}\0${String(candidate.startLine ?? 1).padStart(12, '0')}\0${String(candidate.chunkId ?? '')}`;
}

export class HybridCodeReranker {
  constructor({ neuralWeights = {}, degradedWeights = {} } = {}) {
    this.neuralWeights = Object.freeze({ semantic: 0.48, lexical: 0.18, path: 0.06, symbol: 0.14, graph: 0.06, freshness: 0.03, feedback: 0.03, test: 0.02, ...neuralWeights });
    this.degradedWeights = Object.freeze({ semantic: 0.18, lexical: 0.34, path: 0.10, symbol: 0.20, graph: 0.08, freshness: 0.04, feedback: 0.04, test: 0.02, ...degradedWeights });
  }

  rank(query, candidates = [], { provider = {} } = {}) {
    const degraded = provider.degraded === true;
    const weights = degraded ? this.degradedWeights : this.neuralWeights;
    return candidates.map((candidate) => {
      const semantic = clamp(candidate.semantic);
      const lexical = clamp(candidate.lexical);
      const path = clamp(candidate.pathScore ?? candidate.path);
      const symbol = clamp(candidate.symbolMatch) + (candidate.definition ? 0.2 : 0);
      const graph = clamp(candidate.graph);
      const freshness = clamp(candidate.freshness ?? 1);
      const feedback = Math.max(-0.25, Math.min(0.25, Number(candidate.feedback) || 0));
      const test = clamp(candidate.testRelation);
      const score = semantic * weights.semantic + lexical * weights.lexical + path * weights.path + clamp(symbol) * weights.symbol + graph * weights.graph + freshness * weights.freshness + feedback * weights.feedback + test * weights.test;
      return Object.freeze({
        ...candidate,
        query: String(query ?? ''),
        score,
        providerId: String(provider.id ?? 'unknown'),
        degraded,
        scoreBreakdown: Object.freeze({ semantic, lexical, path, symbol: clamp(symbol), graph, freshness, feedback, test, semanticWeight: weights.semantic }),
      });
    }).sort((left, right) => right.score - left.score || stable(left).localeCompare(stable(right)));
  }
}
