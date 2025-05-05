import { Vercel } from '@vercel/sdk';
import { Deployments } from '@vercel/sdk/esm/sdk/deployments';
import { retrieveEncryptedData } from './main';
import { safeStorage } from 'electron';

async function getVercelCredentials() {
  const encryptedApiKey = await retrieveEncryptedData('vercelApiKey');
  const encryptedTeamId = await retrieveEncryptedData('vercelTeamId');

  if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption is not available on this system.');
  }

  const apiKey = encryptedApiKey ? safeStorage.decryptString(encryptedApiKey) : null;
  const teamId = encryptedTeamId ? safeStorage.decryptString(encryptedTeamId) : null;

  if (!apiKey) {
    throw new Error('Vercel API key not found or could not be decrypted');
  }
  if (!teamId) {
    throw new Error('Vercel Team ID not found or could not be decrypted');
  }
  return { apiKey, teamId };
}

export class VercelPoller {
  private interval: number;
  private timerId: NodeJS.Timeout | null = null;
  private onPollCallback?: (info: any[]) => void;

  constructor(intervalSeconds = 5) {
    this.interval = intervalSeconds * 1000;
  }

  public setCallback(callback: (info: Deployments[]) => void): void {
    this.onPollCallback = callback;
  }

  private async poll(): Promise<void> {
    const credentials = await getVercelCredentials();

    if (!credentials.apiKey) {
      console.error('Vercel API key not initialized');
      return;
    }

    try {
      const vercel = new Vercel({ bearerToken: credentials.apiKey });
      const deployments = await vercel.deployments.getDeployments({
        teamId: credentials.teamId,
        state: 'BUILDING',
      });

      const activeDeployments = deployments.deployments.filter(deploy => {
        // Add any additional filtering you need
        return true;
      });

      if (activeDeployments.length > 0) {
        console.log('Active Vercel deployments:', activeDeployments.length);
      }

      if (this.onPollCallback) {
        this.onPollCallback(activeDeployments);
      }
    } catch (error) {
      console.error('Error polling Vercel:', error);
    }
  }

  public start(): void {
    if (this.timerId) {
      console.warn('VercelPoller is already running.');
      return;
    }
    console.log('Starting VercelPoller...');
    this.timerId = setInterval(() => this.poll(), this.interval);
  }

  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.log('VercelPoller stopped.');
    }
  }
} 