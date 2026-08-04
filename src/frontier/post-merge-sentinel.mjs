import { boundedArray, finite, sha, signed, text } from './frontier-utils.mjs';

const SIGNAL_KINDS = new Set(['ci', 'crash', 'log', 'performance', 'security']);
const SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);

export class PostMergeSentinel {
  constructor({ maxSignals = 2_000, maxIncidents = 500, attributionThreshold = 0.8, ambiguityMargin = 0.1 } = {}) {
    this.maxSignals = maxSignals;
    this.maxIncidents = maxIncidents;
    this.attributionThreshold = attributionThreshold;
    this.ambiguityMargin = ambiguityMargin;
    this.signals = new Map();
    this.incidents = new Map();
  }

  ingestSignal(input = {}) {
    if (this.signals.size >= this.maxSignals) throw new RangeError('post-merge signal limit exceeded');
    const signalId = text(input.signalId, 'signalId', 200);
    if (this.signals.has(signalId)) throw new TypeError(`duplicate signal: ${signalId}`);
    const kind = text(input.kind, 'kind', 40);
    if (!SIGNAL_KINDS.has(kind)) throw new TypeError(`unsupported signal kind: ${kind}`);
    const severity = text(input.severity, 'severity', 20);
    if (!SEVERITIES.has(severity)) throw new TypeError(`unsupported severity: ${severity}`);
    const signal = signed({
      schema: 'forge.post-merge-signal.v1', signalId, kind, severity,
      summary: text(input.summary, 'summary', 500),
      observedAtMs: finite(input.observedAtMs, 'observedAtMs', 0),
      sourceReceiptSha256: sha(input.sourceReceiptSha256, 'sourceReceiptSha256'),
      claims: { rawLogStored: false, secretStored: false },
    });
    this.signals.set(signalId, signal);
    return signal;
  }

  traceIncident(input = {}) {
    if (this.incidents.size >= this.maxIncidents) throw new RangeError('incident limit exceeded');
    const incidentId = text(input.incidentId, 'incidentId', 200);
    if (this.incidents.has(incidentId)) throw new TypeError(`duplicate incident: ${incidentId}`);
    const signalIds = boundedArray(input.signalIds ?? [], 'signalIds', 100).map((id) => text(id, 'signalId', 200));
    if (signalIds.length === 0) throw new TypeError('signalIds are required');
    const signals = signalIds.map((id) => {
      const signal = this.signals.get(id);
      if (!signal) throw new RangeError(`unknown signal: ${id}`);
      return signal;
    });

    let status = 'ambiguous';
    let confidence = 0;
    let attribution = null;
    if (input.attribution && typeof input.attribution === 'object') {
      confidence = finite(input.confidence, 'confidence', 0, 1);
      const required = ['decisionReceiptSha256', 'patchReceiptSha256', 'testReceiptSha256', 'agentReceiptSha256', 'commitReceiptSha256'];
      attribution = Object.fromEntries(required.map((key) => [key, sha(input.attribution[key], key)]));
      status = confidence >= this.attributionThreshold ? 'attributed' : 'ambiguous';
    } else {
      const candidates = boundedArray(input.candidates ?? [], 'candidates', 20).map((candidate) => ({
        patchReceiptSha256: sha(candidate.patchReceiptSha256, 'patchReceiptSha256'),
        confidence: finite(candidate.confidence, 'candidate.confidence', 0, 1),
      })).sort((a, b) => b.confidence - a.confidence);
      const top = candidates[0]; const second = candidates[1];
      confidence = top?.confidence ?? 0;
      if (top && top.confidence >= this.attributionThreshold && (!second || top.confidence - second.confidence >= this.ambiguityMargin)) {
        status = 'attributed'; attribution = { patchReceiptSha256: top.patchReceiptSha256 };
      }
    }

    const incident = signed({
      schema: 'forge.post-merge-incident-trace.v1', incidentId, status, confidence,
      signalIds, signalKinds: [...new Set(signals.map((signal) => signal.kind))].sort(),
      highestSeverity: signals.some((s) => s.severity === 'critical') ? 'critical' : signals.some((s) => s.severity === 'high') ? 'high' : signals.some((s) => s.severity === 'medium') ? 'medium' : 'low',
      attribution,
      selfHealingEligible: status === 'attributed' && confidence >= this.attributionThreshold,
      claims: { rawLogsStored: false, autonomousRepairStarted: false, mergeAllowed: false },
    });
    this.incidents.set(incidentId, incident);
    return incident;
  }

  snapshot() {
    return signed({ schema: 'forge.post-merge-sentinel.v1', signals: [...this.signals.values()].slice(-200), incidents: [...this.incidents.values()].slice(-100), claims: { rawLogsStored: false, autonomousRepairStarted: false } });
  }
}
