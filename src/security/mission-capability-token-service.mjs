import { createHash, randomBytes } from 'node:crypto';
import { signed, text } from '../construction/construction-utils.mjs';

function tokenHash(token) { return createHash('sha256').update(String(token)).digest('hex'); }

export class MissionCapabilityTokenService {
  constructor({ clock = Date.now } = {}) { this.clock = clock; this.records = new Map(); this.sequence = 0; }
  issue({ missionId, actorId, capabilities = [], ttlMs = 60_000, maxUses = 1 } = {}) {
    const mission = text(missionId, 'missionId', 512); const actor = text(actorId, 'actorId', 512);
    const caps = [...new Set(capabilities.map((item) => text(item, 'capability', 256)))].sort();
    if (!caps.length) throw new TypeError('capabilities are required');
    const ttl = Number(ttlMs); const uses = Number(maxUses);
    if (!Number.isInteger(ttl) || ttl < 1 || ttl > 86_400_000) throw new TypeError('ttlMs is invalid');
    if (!Number.isInteger(uses) || uses < 1 || uses > 1000) throw new TypeError('maxUses is invalid');
    const token = randomBytes(32).toString('base64url');
    const hash = tokenHash(token); const issuedAt = Number(this.clock()); const id = `mission-token-${++this.sequence}`;
    this.records.set(hash, { id, missionId: mission, actorId: actor, capabilities: new Set(caps), issuedAt, expiresAt: issuedAt + ttl, remainingUses: uses, revoked: false });
    const grant = signed({ schema: 'forge.mission-capability-grant.v1', grantId: id, missionId: mission, actorId: actor, capabilities: caps, issuedAt, expiresAt: issuedAt + ttl, maxUses: uses, tokenSha256: hash, claims: { rawTokenStoredInReceipt: false } });
    return Object.freeze({ token, grant });
  }
  authorize({ token, missionId, capability, consume = true } = {}) {
    const hash = tokenHash(token); const record = this.records.get(hash); const now = Number(this.clock());
    let allowed = true; let reason = 'allowed';
    if (!record) { allowed = false; reason = 'unknown-token'; }
    else if (record.revoked) { allowed = false; reason = 'revoked'; }
    else if (record.expiresAt <= now) { allowed = false; reason = 'expired'; }
    else if (record.missionId !== String(missionId)) { allowed = false; reason = 'mission-mismatch'; }
    else if (!record.capabilities.has(String(capability))) { allowed = false; reason = 'capability-mismatch'; }
    else if (record.remainingUses < 1) { allowed = false; reason = 'use-limit-exhausted'; }
    if (allowed && consume) record.remainingUses -= 1;
    return signed({ schema: 'forge.mission-capability-decision.v1', grantId: record?.id ?? null, missionId: String(missionId ?? ''), capability: String(capability ?? ''), allowed, reason, remainingUses: record?.remainingUses ?? 0, tokenSha256: hash });
  }
  revoke({ token, actorId } = {}) {
    const hash = tokenHash(token); const record = this.records.get(hash);
    if (record) record.revoked = true;
    return signed({ schema: 'forge.mission-capability-revoke.v1', grantId: record?.id ?? null, actorId: text(actorId, 'actorId', 512), revoked: Boolean(record), tokenSha256: hash });
  }
}
