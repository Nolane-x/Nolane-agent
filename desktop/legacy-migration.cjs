'use strict';

const crypto = require('node:crypto');

const legacyDesktopGlobal = 'forgeDesktop';
const legacySelectDirectoryChannel = 'forge:select-directory';
const legacyEnvironmentPrefix = 'FORGE_STUDIO_';

function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

function readLegacyEnvironment(environment, suffix, eventSink = () => {}) {
  const canonicalName = `NOLANE_AGENT_${suffix}`;
  const legacyName = `${legacyEnvironmentPrefix}${suffix}`;
  const canonical = environment[canonicalName];
  if (canonical !== undefined && canonical !== '') return canonical;
  const legacy = environment[legacyName];
  if (legacy === undefined || legacy === '') return undefined;
  const base = { schema: 'nolane.agent.desktop-environment-migration.v1', canonicalName, legacyName };
  eventSink(Object.freeze({ ...base, receiptSha256: sha256(JSON.stringify(base)) }));
  return legacy;
}

module.exports = Object.freeze({ legacyDesktopGlobal, legacySelectDirectoryChannel, readLegacyEnvironment });
