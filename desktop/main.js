const { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

let mainWindow = null;
let serverProc = null;
let serverUrl = null;
let activeDataDir = null;
let isQuitting = false;

function isDirWritable(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, `.write-test-${process.pid}`);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveDataDir() {
  const portableBase = process.env.PORTABLE_EXECUTABLE_DIR;
  const isPortableFlag =
    Boolean(portableBase) ||
    process.argv.includes('--portable') ||
    process.env.NTK_PORTABLE === '1';

  if (isPortableFlag) {
    const exeDir = portableBase || path.dirname(app.getPath('exe'));
    const candidate = path.join(exeDir, 'NTK-Creator-Command-Data');
    if (isDirWritable(candidate)) {
      return candidate;
    }
  }

  const userData = app.getPath('userData');
  fs.mkdirSync(userData, { recursive: true });
  return userData;
}

function getBundleRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server-bundle');
  }
  return path.join(__dirname, 'server-bundle');
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 3456;
      srv.close(() => resolve(port));
    });
  });
}

function waitForServer(url, timeoutMs = 35000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(`${url}/api/dashboard`, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
        } else if (Date.now() < deadline) {
          setTimeout(attempt, 250);
        } else {
          reject(new Error(`Server responded with status ${res.statusCode}`));
        }
      });
      req.on('error', () => {
        if (Date.now() < deadline) {
          setTimeout(attempt, 250);
        } else {
          reject(new Error('Timed out waiting for local NTK Creator Command server to start'));
        }
      });
      req.setTimeout(2500, () => {
        req.destroy();
      });
    };
    attempt();
  });
}

function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open My Data & Packs Folder',
          click: () => {
            if (activeDataDir) shell.openPath(activeDataDir);
          },
        },
        {
          label: 'Reload Atelier',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            if (mainWindow && serverUrl) mainWindow.loadURL(serverUrl);
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Exit NTK Creator Command' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Server Log',
          click: () => {
            if (activeDataDir) shell.openPath(path.join(activeDataDir, 'server.log'));
          },
        },
        {
          label: 'About NTK Creator Command',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About NTK Creator Command',
              message: `NTK Creator Command v${app.getVersion()}`,
              detail: `Local-first Private Creator Atelier by NTK Hub.\nData directory: ${activeDataDir || ''}`,
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function stopServer() {
  if (serverProc && !serverProc.killed) {
    try {
      serverProc.kill();
    } catch {
      // ignore
    }
    serverProc = null;
  }
}

async function startBackendAndOpenWindow() {
  activeDataDir = resolveDataDir();
  const storageDir = path.join(activeDataDir, 'storage');
  fs.mkdirSync(path.join(storageDir, 'packs'), { recursive: true });
  fs.mkdirSync(path.join(storageDir, 'products'), { recursive: true });

  const bundleRoot = getBundleRoot();
  const serverEntry = path.join(bundleRoot, 'server.js');
  const templateDb = path.join(bundleRoot, 'prisma', 'template.db');
  const dbPath = path.join(activeDataDir, 'ntk-creator-command.db');

  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Missing bundled server entry: ${serverEntry}`);
  }
  if (!fs.existsSync(dbPath)) {
    if (!fs.existsSync(templateDb)) {
      throw new Error(`Missing template database: ${templateDb}`);
    }
    fs.copyFileSync(templateDb, dbPath);
  }

  const port = await findFreePort();
  serverUrl = `http://127.0.0.1:${port}`;
  const logPath = path.join(activeDataDir, 'server.log');
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n--- Booting NTK Creator Command at ${new Date().toISOString()} on ${serverUrl} ---\n`);

  const normalizedDbUrl = `file:${dbPath.replace(/\\/g, '/')}`;
  serverProc = spawn(process.execPath, [serverEntry], {
    cwd: bundleRoot,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOSTNAME: '127.0.0.1',
      PORT: String(port),
      NTK_DATA_DIR: activeDataDir,
      DATABASE_URL: normalizedDbUrl,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  serverProc.stdout.on('data', (chunk) => logStream.write(chunk));
  serverProc.stderr.on('data', (chunk) => logStream.write(chunk));
  serverProc.on('exit', (code) => {
    logStream.write(`\n[server exited with code ${code}]\n`);
    if (!isQuitting && mainWindow) {
      dialog.showErrorBox(
        'Server Stopped Unexpectedly',
        `The local NTK Creator Command engine exited (code ${code}).\n\nCheck log: ${logPath}`
      );
    }
  });

  const bgColor = nativeTheme.shouldUseDarkColors ? '#09090b' : '#f6f3ec';
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 380,
    minHeight: 620,
    title: 'NTK Creator Command',
    backgroundColor: bgColor,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  buildMenu();
  await mainWindow.loadFile(path.join(__dirname, 'splash.html'));

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      if (!url.startsWith(serverUrl)) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (
      (url.startsWith('http://') || url.startsWith('https://')) &&
      !url.startsWith(serverUrl)
    ) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.webContents.session.on('will-download', (_event, item) => {
    const downloadsDir = app.getPath('downloads');
    const target = path.join(downloadsDir, item.getFilename());
    item.setSavePath(target);
    item.once('done', (_e, state) => {
      if (state === 'completed') {
        shell.showItemInFolder(target);
      }
    });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await waitForServer(serverUrl);
  if (mainWindow) {
    await mainWindow.loadURL(serverUrl);
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.handle('ntk:open-data-folder', () => {
    if (activeDataDir) return shell.openPath(activeDataDir);
    return '';
  });
  ipcMain.handle('ntk:get-data-dir', () => activeDataDir || '');

  app.whenReady().then(() => {
    startBackendAndOpenWindow().catch((err) => {
      dialog.showErrorBox(
        'NTK Creator Command Startup Error',
        `${err instanceof Error ? err.message : String(err)}\n\nData folder: ${activeDataDir || 'unknown'}`
      );
      stopServer();
      app.quit();
    });
  });

  app.on('before-quit', () => {
    isQuitting = true;
    stopServer();
  });

  app.on('window-all-closed', () => {
    isQuitting = true;
    stopServer();
    app.quit();
  });
}
