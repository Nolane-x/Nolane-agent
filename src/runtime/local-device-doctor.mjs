import { canonicalSha256 } from '../../vendor/forge-os/src/core/canonical-json.mjs';
function freeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) freeze(child); return Object.freeze(value); }
function finite(value) { const n = Number(value ?? 0); return Number.isFinite(n) && n >= 0 ? n : 0; }
function signed(base) { return freeze({ ...base, receiptSha256: canonicalSha256(base) }); }
export class LocalDeviceDoctor {
  diagnose(input = {}) {
    const metrics = freeze({ totalRamMb: finite(input.totalRamMb), availableRamMb: finite(input.availableRamMb), cpuCores: Math.max(1, Math.floor(finite(input.cpuCores) || 1)), diskFreeMb: finite(input.diskFreeMb), gpuAvailable: input.gpuAvailable === true });
    let profile = 'Lite'; const explanations = [];
    if (metrics.totalRamMb >= 32_000 && metrics.availableRamMb >= 20_000 && metrics.cpuCores >= 12 && metrics.diskFreeMb >= 100_000) profile = 'Performance';
    else if (metrics.totalRamMb >= 12_000 && metrics.availableRamMb >= 6_000 && metrics.cpuCores >= 6 && metrics.diskFreeMb >= 40_000) profile = 'Balanced';
    if (profile === 'Lite') explanations.push('RAM/CPU budget favors one active agent, bounded indexing, and no warm browser or embedding host.');
    if (profile === 'Balanced') explanations.push('Available RAM and CPU support bounded parallelism with idle eviction.');
    if (profile === 'Performance') explanations.push('High RAM, CPU, and disk headroom support larger pools while preserving viability limits.');
    if (!metrics.gpuAvailable) explanations.push('No GPU capability was used to justify the profile.');
    return signed({ schema: 'forge.local-device-doctor.v1', profile, metrics, explanations: freeze(explanations), appliedAutomatically: false });
  }
}
