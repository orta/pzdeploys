import './index.css';


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
    if (credentials.vercelTeamId) {
      (document.getElementById('vercel-team-id') as HTMLInputElement).value = credentials.vercelTeamId;
    }
  } catch (error) {
    console.error('Error fetching credentials:', error);
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const renderInput = document.getElementById('render-password') as HTMLInputElement;
      const vercelInput = document.getElementById('vercel-api-key') as HTMLInputElement;
      const vercelTeamIdInput = document.getElementById('vercel-team-id') as HTMLInputElement;
      const renderApiPassword = renderInput.value;
      const vercelApiKey = vercelInput.value;
      const vercelTeamId = vercelTeamIdInput.value;

      try {
        // Call the secure API exposed by the preload script
        const result = await (window as any).secureAPI.storeCredentials({ renderApiPassword, vercelApiKey, vercelTeamId });
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
