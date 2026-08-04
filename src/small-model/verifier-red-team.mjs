import { canonicalSha256, deepFreeze } from './shared.mjs';

export class VerifierRedTeam {
  #probes = [];

  inspect({ verifierId, output } = {}) {
    if (!verifierId || !output || typeof output !== 'object') throw new TypeError('verifierId and output are required');
    const findings = [];
    if (typeof output.pass !== 'boolean') findings.push('non-boolean-verdict');
    if (output.selfReported === true) findings.push('self-reported-pass');
    if (output.hiddenDataAccess === true) findings.push('hidden-data-access');
    if (output.writeAttempt === true || output.readOnly === false) findings.push('write-attempt');
    if (!Array.isArray(output.evidence) || output.evidence.length === 0) findings.push('missing-evidence');
    if (output.tamperedExpected === true) findings.push('expected-result-tampering');
    const base = {
      schema: 'nolane.small-model.verifier-red-team-receipt.v1', verifierId: String(verifierId),
      accepted: findings.length === 0, findings: [...new Set(findings)].sort(),
    };
    const receipt = deepFreeze({ ...base, receiptSha256: canonicalSha256(base) });
    this.#probes.push(receipt);
    return receipt;
  }

  snapshot() {
    return deepFreeze({ schema: 'nolane.small-model.verifier-red-team.v1', probes: this.#probes.length, rejected: this.#probes.filter((item) => !item.accepted).length });
  }
}
