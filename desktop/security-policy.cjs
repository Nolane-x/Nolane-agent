'use strict';

function browserWindowOptions(preload) {
  return Object.freeze({
    width: 1480,
    height: 940,
    minWidth: 980,
    minHeight: 680,
    show: false,
    backgroundColor: '#1e1e1e',
    title: 'Nolane Agent',
    autoHideMenuBar: true,
    webPreferences: Object.freeze({
      preload,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      nodeIntegrationInWorker: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
      devTools: true,
    }),
  });
}

function parse(value) {
  try { return new URL(String(value)); } catch { return null; }
}

function isAllowedRuntimeUrl(candidate, runtimeOrigin) {
  const url = parse(candidate);
  const origin = parse(runtimeOrigin);
  if (!url || !origin) return false;
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) return false;
  return url.protocol === 'http:' && url.origin === origin.origin;
}

function isSafeExternalUrl(candidate) {
  const url = parse(candidate);
  return Boolean(url && url.protocol === 'https:' && !url.username && !url.password);
}

module.exports = Object.freeze({ browserWindowOptions, isAllowedRuntimeUrl, isSafeExternalUrl });
