import { Vercel } from '@vercel/sdk';
import { Deployments } from '@vercel/sdk/esm/sdk/deployments';
import keytar from 'keytar';

async function getVercelCredentials() {
  const apiKey = await keytar.getPassword('pzdeploys', 'vercelApiKey');
  const teamId = await keytar.getPassword('pzdeploys', 'vercelTeamId');
  if (!apiKey) {
    throw new Error('Vercel API key not found in keytar');
  }
  if (!teamId) {
    throw new Error('Vercel Team ID not found in keytar');
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