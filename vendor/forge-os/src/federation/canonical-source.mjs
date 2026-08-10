import { isIP } from 'node:net';
import { canonicalSha256 } from '../core/canonical-json.mjs';

const PRIVATE_V4 = [
  /^10\./, /^127\./, /^169\.254\./, /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./, /^0\./,
];

function isPrivateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (isIP(host) === 4) return PRIVATE_V4.some((rule) => rule.test(host));
  if (isIP(host) === 6) return host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
  return false;
}

export function assertSafeFederationUrl(input, { allowedHosts = null } = {}) {
  const url = new URL(String(input));
  if (url.protocol !== 'https:') throw new TypeError('Federation URLs must use HTTPS');
  if (url.username || url.password) throw new TypeError('Federation URLs cannot contain credentials');
  if (url.hash) throw new TypeError('Federation URLs cannot contain fragments');
  if (isPrivateHost(url.hostname)) throw new TypeError('Federation URLs cannot target private or local networks');
  if (allowedHosts && !allowedHosts.includes(url.hostname.toLowerCase())) throw new TypeError(`Federation host is not allowed: ${url.hostname}`);
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString().replace(/\/$/, '');
}

export function sourceCoordinate(source) {
  if (!source?.kind || !source?.url || !source?.revision) throw new TypeError('Source coordinate requires kind, url, and revision');
  return `${source.kind}:${assertSafeFederationUrl(source.url)}@${source.revision}`;
}

export function providerDigest(provider) {
  const stable = {
    providerId: provider.providerId,
    capabilityId: provider.capabilityId,
    sourceId: provider.sourceId,
    sourceCoordinate: provider.sourceCoordinate,
    contentDigest: provider.contentDigest,
    kind: provider.kind,
    title: provider.title,
    license: provider.license,
    compatibility: {
      agents: [...(provider.compatibility?.agents ?? [])].sort(),
      tools: [...(provider.compatibility?.tools ?? [])].sort(),
    },
  };
  return canonicalSha256(stable);
}
