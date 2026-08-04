export class AutoscalingController {
  constructor({ clock = () => Date.now() } = {}) { this.clock = clock; this.lastScaleUpAt = -Infinity; this.lastScaleDownAt = -Infinity; }
  decide(metrics = {}, policy = {}) {
    const min = Math.max(0, Number(policy.minWorkers ?? 0)); const max = Math.max(min, Number(policy.maxWorkers ?? 100)); const target = Math.max(1, Number(policy.targetJobsPerWorker ?? 1)); const active = Math.max(0, Number(metrics.activeWorkers ?? 0)); const depth = Math.max(0, Number(metrics.queueDepth ?? 0)); const pressure = depth === 0 ? min : Math.ceil(depth / target); let desired = Math.max(min, Math.min(max, pressure)); const now = this.clock(); let reason = depth ? 'queue-pressure' : 'idle-floor';
    if (desired > active) this.lastScaleUpAt = now;
    if (desired < active) { const cooldown = Math.max(0, Number(policy.scaleDownCooldownMs ?? 60_000)); if (now - this.lastScaleUpAt < cooldown || now - this.lastScaleDownAt < cooldown) { desired = active; reason = 'scale-down-cooldown'; } else this.lastScaleDownAt = now; }
    return Object.freeze({ desiredWorkers: desired, currentWorkers: active, queueDepth: depth, reason, boundedBy: desired === max ? 'max' : desired === min ? 'min' : null });
  }
}
