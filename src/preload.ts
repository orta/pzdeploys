// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  storeCredentials: (credentials: {
    renderApiPassword: string,
    vercelApiKey: string,
    vercelTeamId: string
  }) => ipcRenderer.invoke('store-credentials', credentials),
  getCredentials: () => ipcRenderer.invoke('get-credentials'),
});
