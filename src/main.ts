import path from 'node:path';
import fs from 'node:fs/promises';
import started from 'electron-squirrel-startup';

import { app, BrowserWindow, ipcMain, Tray, Menu, shell, safeStorage as electronSafeStorage } from 'electron';
import { RenderDeploy, RenderPoller } from './renderPoller';
import { VercelPoller } from './vercelPoller';
import { Service } from '@llimllib/renderapi';

// import iconTemplate from '../resources/iconTemplate.png?url';
// import uploadingTemplate from '../resources/uploadingTemplate.png?url';

// console.log(iconTemplate);
const iconTemplate = path.join(__dirname, '../build/iconTemplate.png');
const uploadingTemplate = path.join(__dirname, '../build/uploadingTemplate.png');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  createTray();

};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});



let tray: Tray | null = null;

const renderPoller = new RenderPoller();
const vercelPoller = new VercelPoller();

type VercelDeploy = {
  name: string;
  id: string;
  inspectorUrl: string;
  creator: { username: string };
  meta: { githubCommitMessage: string, githubCommitOrg: string, githubCommitRepo: string, githubCommitSha: string };
};

// Combine both render and vercel deploys in the menu
function updateTrayMenu(renderDeploys: { service: Service, deploy: RenderDeploy["deploy"] }[] = [], vercelDeploys: VercelDeploy[] = []) {
  if (!tray) return;

  const menuTemplate: Electron.MenuItemConstructorOptions[] = [];

  // Add Render.com deploys
  if (renderDeploys.length > 0) {
    menuTemplate.push({ label: 'Render Deploys', enabled: false });
    renderDeploys.forEach(deploy => {
      const message = typeof deploy.deploy.commit === 'string' ? deploy.deploy.commit : deploy.deploy.commit?.message;
      menuTemplate.push({
        label: `${deploy.service.name} - ${message}`,
        submenu: [
          { 
            label: 'Open in Render',
            click: () => {
              shell.openExternal(`https://dashboard.render.com/web/${deploy.service.id}/deploys/${deploy.deploy.id}`);
            }
          }
        ]
      });
    });
  }

  // Add Vercel deploys
  if (vercelDeploys.length > 0) {
    if (renderDeploys.length > 0) menuTemplate.push({ type: 'separator' });
    menuTemplate.push({ label: 'Vercel Deploys', enabled: false });
    vercelDeploys.forEach(deploy => {
      console.log(deploy);
      menuTemplate.push({
        label: `${deploy.name} - ${deploy.meta?.githubCommitMessage || 'No message'}`,
        submenu: [
          { 
            label: 'Open in Vercel',
            click: () => {
              shell.openExternal(deploy.inspectorUrl);
            }
          },
          {
            label: 'Open in GitHub',
            click: () => {
              shell.openExternal(`https://github.com/${deploy.meta.githubCommitOrg}/${deploy.meta.githubCommitRepo}/commit/${deploy.meta.githubCommitSha}`);
            }
          }
        ]
      });
    });
  }

  // Show "no deploys" if neither has active deploys
  if (menuTemplate.length === 0) {
    menuTemplate.push({ label: 'No active deploys', enabled: false });
  }

  // Add quit option
  menuTemplate.push(
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  );

  const contextMenu = Menu.buildFromTemplate(menuTemplate);
  tray.setContextMenu(contextMenu);

  // Update icon if there are any deploys from either service
  const hasActiveDeploys = renderDeploys.length > 0 || vercelDeploys.length > 0;
  tray.setImage( hasActiveDeploys ? uploadingTemplate : iconTemplate);
}

// Keep track of latest deploys from both services
let latestRenderDeploys: any[] = [];
let latestVercelDeploys: any[] = [];

renderPoller.setCallback((deploys) => {
  latestRenderDeploys = deploys;
  updateTrayMenu(latestRenderDeploys, latestVercelDeploys);
});

vercelPoller.setCallback((deploys) => {
  latestVercelDeploys = deploys;
  updateTrayMenu(latestRenderDeploys, latestVercelDeploys);
});

// Start both pollers
renderPoller.start();
vercelPoller.start();

const createTray = (): void => {
  const iconPath = iconTemplate
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: '...', enabled: false }
  ]);
  
  tray.setToolTip('pzdeploys');
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    tray?.popUpContextMenu();
  });
};



ipcMain.handle('store-credentials', async (event, data) => {
  const { renderApiPassword, vercelApiKey, vercelTeamId } = data;
  try {
    if (!electronSafeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system.');
    }
    // Store the Render.com API password securely
    const encryptedRenderPass = electronSafeStorage.encryptString(renderApiPassword);
    // Use a simple storage mechanism like electron-store or fs for the encrypted data
    // For simplicity here, let's assume we store it in a file or settings store.
    // This example uses placeholder storage logic - replace with actual storage.
    await storeEncryptedData('renderApiPassword', encryptedRenderPass);

    // Store the Vercel API key securely
    const encryptedVercelKey = electronSafeStorage.encryptString(vercelApiKey);
    await storeEncryptedData('vercelApiKey', encryptedVercelKey);

    // Store the Vercel team ID (encrypting it as well for consistency)
    const encryptedVercelTeamId = electronSafeStorage.encryptString(vercelTeamId);
    await storeEncryptedData('vercelTeamId', encryptedVercelTeamId);

    return { success: true };
  } catch (error) {
    console.error('Error storing credentials:', error);
    // Re-throw the error to be caught by the renderer process
    throw error;
  }
});

ipcMain.handle('get-credentials', async () => {
  try {
    if (!electronSafeStorage.isEncryptionAvailable()) {
      console.warn('Encryption is not available, cannot retrieve credentials.');
      return { renderApiPassword: null, vercelApiKey: null, vercelTeamId: null };
    }

    const encryptedRenderPass = await retrieveEncryptedData('renderApiPassword');
    const encryptedVercelKey = await retrieveEncryptedData('vercelApiKey');
    const encryptedVercelTeamId = await retrieveEncryptedData('vercelTeamId');

    const renderApiPassword = encryptedRenderPass ? electronSafeStorage.decryptString(encryptedRenderPass) : null;
    const vercelApiKey = encryptedVercelKey ? electronSafeStorage.decryptString(encryptedVercelKey) : null;
    const vercelTeamId = encryptedVercelTeamId ? electronSafeStorage.decryptString(encryptedVercelTeamId) : null;

    return { renderApiPassword, vercelApiKey, vercelTeamId };
  } catch (error) {
    console.error('Error retrieving credentials:', error);
    // Return nulls or handle error appropriately
    return { renderApiPassword: null, vercelApiKey: null, vercelTeamId: null };
  }
});

// Placeholder functions for storing/retrieving encrypted data.
// Replace these with your actual storage implementation (e.g., using electron-store or fs).
// IMPORTANT: safeStorage only encrypts/decrypts; it doesn't store the data itself.
async function storeEncryptedData(key: string, data: Buffer) {
  // Example: Store in a file (ensure proper error handling and file path management)
  // This is a basic example, consider using a more robust solution like electron-store.
  const storagePath = path.join(app.getPath('userData'), 'credentials.json');
  let credentials: { [key: string]: string } = {};
  try {
    const fileData = await fs.readFile(storagePath, 'utf-8');
    credentials = JSON.parse(fileData);
  } catch (err) {
    // File might not exist yet, which is okay
    if (err.code !== 'ENOENT') {
      console.error('Error reading credentials file:', err);
    }
  }
  // Storing the Buffer as a Base64 string in JSON
  credentials[key] = data.toString('base64');
  await fs.writeFile(storagePath, JSON.stringify(credentials, null, 2));
  console.log(`Stored encrypted data for key: ${key}`);
}

// Export retrieveEncryptedData
export async function retrieveEncryptedData(key: string): Promise<Buffer | null> {
  // Example: Retrieve from a file
  const storagePath = path.join(app.getPath('userData'), 'credentials.json');
  try {
    const fileData = await fs.readFile(storagePath, 'utf-8');
    const credentials = JSON.parse(fileData);
    const base64Data = credentials[key];
    if (base64Data) {
      // Convert Base64 string back to Buffer
      return Buffer.from(base64Data, 'base64');
    }
    return null;
  } catch (err) {
    // File might not exist or key not found
    if (err.code !== 'ENOENT') {
      console.error(`Error reading credentials file for key ${key}:`, err);
    }
    return null;
  }
}

// Export safeStorage
export const safeStorage = electronSafeStorage; // Export for external use
