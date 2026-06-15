// Electron main process — Financeiro desktop wrapper
// Carrega http://localhost:5173 (Vite dev server) já em execução
const { app, BrowserWindow, shell, nativeTheme } = require('electron');
const http = require('http');
const https = require('https');

const APP_URL = process.env.FINANCEIRO_APP_URL || 'http://localhost:5173';
const RETRY_INTERVAL = 500;
const RETRY_TIMEOUT = 30_000;

let mainWindow = null;

function waitForServer(url, timeout) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    function attempt() {
      const client = new URL(url).protocol === 'https:' ? https : http;
      client.get(url, (res) => {
        res.resume();
        resolve();
      }).on('error', () => {
        if (Date.now() - start > timeout) {
          reject(new Error(`Timeout aguardando ${url}`));
        } else {
          setTimeout(attempt, RETRY_INTERVAL);
        }
      });
    }
    attempt();
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Financeiro',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(APP_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Abrir links externos no browser do sistema
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  // Aguarda o Vite dev server estar disponível
  try {
    await waitForServer(APP_URL, RETRY_TIMEOUT);
  } catch (err) {
    console.error(err.message);
    app.quit();
    return;
  }
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
