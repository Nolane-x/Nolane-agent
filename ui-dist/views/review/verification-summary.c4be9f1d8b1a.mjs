const SHA256 = /^[a-f0-9]{64}$/i;
const validReceipt = (value) => SHA256.test(value ?? '');
export function buildVerificationSummary({ tests = [], security = [], scope = {}, evidence = [] } = {}) {
  const testsBound = tests.length > 0 && tests.every((item) => item.status === 'pass' && validReceipt(item.receiptSha256));
  const securityBound = security.every((item) => item.status === 'pass' && validReceipt(item.receiptSha256));
  const evidenceBound = evidence.length > 0 && evidence.every((item) => validReceipt(item.sha256) && item.verifierIndependent === true);
  const intended = new Set((scope.intendedFiles ?? []).map(String));
  const changed = (scope.changedFiles ?? []).map(String);
  const outOfScope = changed.filter((path) => !intended.has(path));
  const risk = outOfScope.length > 0 || !securityBound ? 'high' : !testsBound || !evidenceBound ? 'medium' : 'low';
  return Object.freeze({ testsBound, securityBound, evidenceBound, outOfScope: Object.freeze(outOfScope), risk, readyToShip: testsBound && securityBound && evidenceBound && outOfScope.length === 0 });
}
