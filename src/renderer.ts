/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/latest/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import './index.css';

console.log('👋 This message is being logged by "renderer.js", included via webpack');

document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('credentials-form');
  const messageElem = document.getElementById('message');
  
  // Retrieve and populate saved credentials
  try {
    const credentials = await (window as any).secureAPI.getCredentials();
    if (credentials.renderApiPassword) {
      (document.getElementById('render-password') as HTMLInputElement).value = credentials.renderApiPassword;
    }
    if (credentials.vercelApiKey) {
      (document.getElementById('vercel-api-key') as HTMLInputElement).value = credentials.vercelApiKey;
    }
  } catch (error) {
    console.error('Error fetching credentials:', error);
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const renderInput = document.getElementById('render-password') as HTMLInputElement;
      const vercelInput = document.getElementById('vercel-api-key') as HTMLInputElement;
      const renderApiPassword = renderInput.value;
      const vercelApiKey = vercelInput.value;

      try {
        // Call the secure API exposed by the preload script
        const result = await (window as any).secureAPI.storeCredentials({ renderApiPassword, vercelApiKey });
        if (result) {
          messageElem.textContent = 'Credentials saved successfully!';
        } else {
          messageElem.textContent = 'Error saving credentials.';
        }
      } catch (error) {
        console.error('Error saving credentials:', error);
        messageElem.textContent = 'Error saving credentials.';
      }
    });
  }
});
