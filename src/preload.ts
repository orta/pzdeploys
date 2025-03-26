// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('secureAPI', {
  storeCredentials: (data: { renderApiPassword: string; vercelApiKey: string; }) =>
    ipcRenderer.invoke('store-credentials', data),
  getCredentials: () => ipcRenderer.invoke('get-credentials')
});
