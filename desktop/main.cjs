'use strict';

const path = require('node:path');
const { mkdir } = require('node:fs/promises');
const { app, BrowserWindow, dialog, ipcMain, screen, session, shell, utilityProcess } = require('electron');
const { browserWindowOptions, isAllowedRuntimeUrl, isSafeExternalUrl } = require('./security-policy.cjs');
const { RuntimeSupervisor } = require('./runtime-supervisor.cjs');
const { ElectronUpdateController } = require('./update-controller.cjs');
const { DesktopUpdateCoordinator } = require('./update-coordinator.cjs');
const { legacySelectDirectoryChannel, readLegacyEnvironment } = require('./legacy-migration.cjs');
const { WindowStateStore, resolveWindowBounds } = require('./window-state-store.cjs');

app.enableSandbox();
const configuredUserData = process.env.NOLANE_AGENT_ELECTRON_USER_DATA ?? readLegacyEnvironment(process.env, 'ELECTRON_USER_DATA');
if (configuredUserData) app.setPath('userData', path.resolve(configuredUserData));

const postUpdateLaunch = process.argv.includes('--post-update');
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

let mainWindow = null;
let supervisor = null;
let updateController = null;
let updateCoordinator = null;
let windowStateStore = null;
let runtimeOrigin = null;
let runtimeToken = null;
let quitting = false;
let restartHistory = [];

function appRoot() { return app.getAppPath(); }
function preloadPath() { return path.join(appRoot(), 'desktop', 'preload.cjs'); }

function desktopLanguage() {
  const configured = String(process.env.NOLANE_AGENT_LOCALE ?? '').trim().toLowerCase();
  if (configured) return configured.startsWith('vi') ? 'vi' : 'en';
  return String(app.getLocale?.() ?? '').toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

function desktopCopy(key) {
  const vi = {
    chooseProject: 'Chọn thư mục dự án cho Nolane Agent',
    renderStopped: (reason) => `Giao diện bị dừng (${reason}). Nolane Agent đang khởi động lại cửa sổ.`,
    runtimeRecoveryTitle: 'Nolane Agent đang khôi phục runtime',
    runtimeRecoveryHint: 'Mission và checkpoint đã được lưu. Ứng dụng sẽ tự thử lại; không cần giao việc lại từ đầu.',
    runtimeUnexpectedExit: (code) => `Agent runtime kết thúc ngoài dự kiến với mã ${code}.`,
    runtimeCheckpoint: 'Đang mở lại agent runtime từ checkpoint gần nhất…',
    runtimeStarting: 'Đang khởi động agent runtime…',
  };
  const en = {
    chooseProject: 'Choose a project folder for Nolane Agent',
    renderStopped: (reason) => `The interface stopped (${reason}). Nolane Agent is restarting the window.`,
    runtimeRecoveryTitle: 'Nolane Agent is recovering the runtime',
    runtimeRecoveryHint: 'Your mission and checkpoint were saved. The app will retry automatically; you do not need to start over.',
    runtimeUnexpectedExit: (code) => `The agent runtime exited unexpectedly with code ${code}.`,
    runtimeCheckpoint: 'Reopening the agent runtime from the latest checkpoint…',
    runtimeStarting: 'Starting the agent runtime…',
  };
  return (desktopLanguage() === 'vi' ? vi : en)[key];
}

function safeSender(event) {
  const url = event?.senderFrame?.url ?? event?.sender?.getURL?.() ?? '';
  return Boolean(runtimeOrigin && isAllowedRuntimeUrl(url, runtimeOrigin));
}

function installIpc() {
  const selectDirectory = async (event) => {
    if (!safeSender(event)) throw new Error('Untrusted IPC sender');
    const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory', 'createDirectory'], title: desktopCopy('chooseProject') });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  };
  ipcMain.handle('nolane:select-directory', selectDirectory);
  ipcMain.handle(legacySelectDirectoryChannel, selectDirectory);
  ipcMain.handle('nolane:update-status', async (event) => {
    if (!safeSender(event)) throw new Error('Untrusted IPC sender');
    return updateCoordinator?.state() ?? updateController?.status() ?? Object.freeze({ ready: false, reason: 'update-controller-unavailable' });
  });
  ipcMain.handle('nolane:update-state-get', async (event) => {
    if (!safeSender(event)) throw new Error('Untrusted IPC sender');
    return updateCoordinator?.state() ?? Object.freeze({ schema: 'nolane.desktop-update-state.v1', state: 'idle', ready: false });
  });
  ipcMain.handle('nolane:update-check', async (event) => {
    if (!safeSender(event)) throw new Error('Untrusted IPC sender');
    return updateCoordinator.checkForUpdates({ manual: true });
  });
  ipcMain.handle('nolane:update-download', async (event) => {
    if (!safeSender(event)) throw new Error('Untrusted IPC sender');
    return updateCoordinator.downloadAvailableUpdate();
  });
  ipcMain.handle('nolane:update-defer', async (event) => {
    if (!safeSender(event)) throw new Error('Untrusted IPC sender');
    return updateCoordinator.deferUpdate();
  });
  ipcMain.handle('nolane:update-ignore', async (event) => {
    if (!safeSender(event)) throw new Error('Untrusted IPC sender');
    return updateCoordinator.ignoreVersion();
  });
  ipcMain.handle('nolane:update-install-and-restart', async (event) => {
    if (!safeSender(event)) throw new Error('Untrusted IPC sender');
    return updateCoordinator.installUpdateAndRestart();
  });
  ipcMain.handle('nolane:core-status', async (event) => {
    if (!safeSender(event)) throw new Error('Untrusted IPC sender');
    if (!runtimeOrigin || !runtimeToken) return Object.freeze({ ready: false, reason: 'runtime-unavailable' });
    const response = await fetch(`${runtimeOrigin}/api/nolane/native-core/status?token=${encodeURIComponent(runtimeToken)}`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      redirect: 'error',
    });
    if (!response.ok) throw new Error(`Native core status failed with HTTP ${response.status}`);
    return response.json();
  });
}

function hardenSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  ses.setPermissionCheckHandler(() => false);
}

function createWindow() {
  const defaults = browserWindowOptions(preloadPath());
  let saved = null;
  try { saved = windowStateStore?.read() ?? null; } catch (error) { console.warn(`[window-state] ${error.code ?? 'read-failed'}: ${error.message}`); }
  const resolved = resolveWindowBounds(saved, screen.getAllDisplays(), defaults);
  const win = new BrowserWindow({ ...defaults, ...resolved.bounds, webPreferences: defaults.webPreferences });
  let persistTimer = null;
  const persistWindowState = () => {
    if (!windowStateStore || win.isDestroyed()) return;
    const bounds = win.getNormalBounds();
    const display = screen.getDisplayMatching(bounds);
    try { windowStateStore.save({ bounds, maximized: win.isMaximized(), displayId: display?.id ?? null }); }
    catch (error) { console.warn(`[window-state] ${error.code ?? 'write-failed'}: ${error.message}`); }
  };
  const schedulePersist = () => { clearTimeout(persistTimer); persistTimer = setTimeout(persistWindowState, 250); };
  win.on('move', schedulePersist);
  win.on('resize', schedulePersist);
  win.on('maximize', schedulePersist);
  win.on('unmaximize', schedulePersist);
  win.on('close', () => { clearTimeout(persistTimer); persistWindowState(); });
  if (resolved.maximized) win.once('ready-to-show', () => win.maximize());
  win.once('ready-to-show', () => win.show());
  win.webContents.on('will-navigate', (event, url) => {
    if (!runtimeOrigin || !isAllowedRuntimeUrl(url, runtimeOrigin)) event.preventDefault();
  });
  win.webContents.on('will-attach-webview', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) shell.openExternal(url).catch(() => {});
    return { action: 'deny' };
  });
  win.webContents.on('render-process-gone', (_event, details) => {
    if (!quitting) showRuntimeFailure(desktopCopy('renderStopped')(details.reason));
  });
  win.on('closed', () => { if (mainWindow === win) mainWindow = null; });
  return win;
}

function errorDocument(message) {
  const safe = String(message).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><meta charset="utf-8"><style>body{margin:0;background:#1e1e1e;color:#ddd;font:14px system-ui;display:grid;place-items:center;height:100vh}.card{max-width:560px;padding:28px;border:1px solid #3c3c42;border-radius:16px;background:#242428}h1{font-size:20px;color:#fff}p{line-height:1.6;color:#aaa}</style><div class="card"><h1>${desktopCopy('runtimeRecoveryTitle')}</h1><p>${safe}</p><p>${desktopCopy('runtimeRecoveryHint')}</p></div></html>`)}`;
}

function showRuntimeFailure(message) {
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createWindow();
  mainWindow.loadURL(errorDocument(message)).catch(() => {});
}

function boundedRestartAllowed() {
  const now = Date.now();
  restartHistory = restartHistory.filter((time) => now - time < 60_000);
  if (restartHistory.length >= 3) return false;
  restartHistory.push(now);
  return true;
}

async function publishUpdateState() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const status = updateCoordinator?.state() ?? await updateController?.status().catch((error) => ({ ready: false, reason: 'update-status-error', message: error.message }));
  mainWindow.webContents.send('nolane:update-state', status);
}

async function startRuntimeAndLoad({ recovering = false } = {}) {
  const root = appRoot();
  const userData = app.getPath('userData');
  await mkdir(userData, { recursive: true });
  const runtimeFile = path.resolve((process.env.NOLANE_AGENT_ELECTRON_RUNTIME_FILE ?? readLegacyEnvironment(process.env, 'ELECTRON_RUNTIME_FILE')) || path.join(userData, 'runtime-electron.json'));
  if (!supervisor) {
    supervisor = new RuntimeSupervisor({
      runtimeFile,
      modulePath: path.join(root, 'src', 'app.mjs'),
      cwd: root,
      startupTimeoutMs: Number(process.env.NOLANE_AGENT_STARTUP_TIMEOUT_MS) || 45_000,
      maxRestarts: 2,
      env: {
        ...process.env,
        NOLANE_AGENT_HOST: '127.0.0.1',
        NOLANE_AGENT_PORT: '0',
        NOLANE_AGENT_DATA_DIR: userData,
        NOLANE_AGENT_WORKSPACE: userData,
        NOLANE_AGENT_RUNTIME_FILE: runtimeFile,
        NOLANE_AGENT_POST_UPDATE: postUpdateLaunch ? 'true' : 'false',
        NOLANE_AGENT_PTY_HOST: path.join(root, 'native', process.platform === 'win32' ? 'NolanePty.exe' : 'NolanePty'),
        NOLANE_AGENT_CREDENTIAL_HELPER: path.join(root, 'native', process.platform === 'win32' ? 'NolaneCredential.exe' : 'NolaneCredential'),
      },
      processFactory: ({ modulePath, cwd, env }) => {
        const child = utilityProcess.fork(modulePath, [], { cwd, env, stdio: 'pipe', serviceName: 'Nolane Agent Runtime' });
        child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
        child.stderr?.on('data', (chunk) => process.stderr.write(chunk));
        return child;
      },
      onUnexpectedExit: ({ code }) => {
        if (quitting) return;
        showRuntimeFailure(desktopCopy('runtimeUnexpectedExit')(code));
        if (boundedRestartAllowed()) setTimeout(() => startRuntimeAndLoad({ recovering: true }).catch((error) => showRuntimeFailure(error.message)), 700);
      },
    });
  }
  if (recovering) showRuntimeFailure(desktopCopy('runtimeCheckpoint'));
  const runtime = await supervisor.start();
  runtimeOrigin = new URL(runtime.url).origin;
  runtimeToken = runtime.token;
  if (!mainWindow || mainWindow.isDestroyed()) mainWindow = createWindow();
  const target = `${runtimeOrigin}/?token=${encodeURIComponent(runtime.token)}&desktop=electron`;
  await mainWindow.loadURL(target);
  const recovery = await updateController?.markHealthy().catch((error) => ({ state: 'recovery-error', message: error.message }));
  await updateCoordinator?.start();
  await publishUpdateState();
  if (recovery?.state === 'healthy') mainWindow.webContents.send('nolane:update-state', { ready: false, state: 'healthy', version: app.getVersion(), postUpdateLaunch });
}

app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  hardenSession();
  windowStateStore = new WindowStateStore({ userDataDir: app.getPath('userData') });
  updateController = new ElectronUpdateController({ userDataDir: app.getPath('userData'), currentVersion: app.getVersion(), quit: () => { quitting = true; supervisor?.stop().finally(() => app.quit()); } });
  updateCoordinator = new DesktopUpdateCoordinator({
    updateController,
    userDataDir: app.getPath('userData'),
    getRuntimeConnection: () => ({ origin: runtimeOrigin, token: runtimeToken }),
    emit: (state) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('nolane:update-state', state); },
  });
  installIpc();
  mainWindow = createWindow();
  showRuntimeFailure(desktopCopy('runtimeStarting'));
  try { await startRuntimeAndLoad(); } catch (error) { showRuntimeFailure(error?.message ?? error); }
});

app.on('activate', () => {
  if (!mainWindow) {
    mainWindow = createWindow();
    if (runtimeOrigin) startRuntimeAndLoad().catch((error) => showRuntimeFailure(error.message));
  }
});

app.on('before-quit', async (event) => {
  if (quitting) return;
  event.preventDefault();
  quitting = true;
  updateCoordinator?.stop();
  await supervisor?.stop().catch(() => {});
  app.quit();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
