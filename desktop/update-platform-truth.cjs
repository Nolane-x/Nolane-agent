'use strict';

const table = require('../config/release-platform-capabilities.json');

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function clone(value) { return structuredClone(value); }

function unknownPlatform(platform) {
  return freeze({
    schema: 'nolane.desktop-update-platform-truth.v1',
    sourceSchema: table.schema,
    platform: String(platform ?? 'unknown'),
    label: 'Unknown platform',
    packageKinds: [],
    signing: { status: 'unknown', mechanism: null },
    notarization: { status: 'unknown', mechanism: null },
    updateTrust: { enabled: false, mechanism: null },
    inAppUpdateHandoff: { enabled: false, mechanism: null, reason: 'No verified in-app update handoff exists for this platform.' },
    nativeInstallHandoff: { enabled: false, mechanism: null, reason: 'No verified native install handoff exists for this platform.' },
    recovery: { preUpdateSnapshot: true, migrationJournal: true, postUpdateHealth: true, realUpdateReplay: 'unknown' },
  });
}

function resolveDesktopUpdatePlatformTruth(platform = process.platform) {
  const key = String(platform ?? '');
  const source = table.platforms?.[key];
  if (!source) return unknownPlatform(key);
  return freeze({ schema: 'nolane.desktop-update-platform-truth.v1', sourceSchema: table.schema, platform: key, ...clone(source) });
}

function supportsPackageKind(platformTruth, packageKind) {
  const kind = String(packageKind ?? '').trim().toLowerCase();
  return Boolean(kind && platformTruth?.packageKinds?.includes(kind));
}

module.exports = Object.freeze({ resolveDesktopUpdatePlatformTruth, supportsPackageKind });
