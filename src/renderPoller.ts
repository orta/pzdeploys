import { getServices, renderGet, Service } from '@llimllib/renderapi';
import { retrieveEncryptedData } from './main'; // Import helper
import { safeStorage } from 'electron'; // Import safeStorage

async function getRenderCredentials() {
  // Retrieve encrypted data using the helper from main.ts
  const encryptedApiPass = await retrieveEncryptedData('renderApiPassword');

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Encryption is not available on this system.');
  }

  // Decrypt the data
  const apiPass = encryptedApiPass ? safeStorage.decryptString(encryptedApiPass) : null;

  if (!apiPass) {
    throw new Error('Render API password not found or could not be decrypted');
  }
  
  return { apiPass };
}

export class RenderPoller {
  private interval: number;
  private timerId: NodeJS.Timeout | null = null;
  private onPollCallback?: (services: any[]) => void;

  constructor(intervalSeconds = 30) { // default poll every 30 seconds
    this.interval = intervalSeconds * 1000;
  }

  /**
   * Sets a callback function to be called after each successful poll
   * @param callback Function to be called with the filtered services
   */
  public setCallback(callback: (services: { service: Service, deploy: RenderDeploy["deploy"] }[]) => void): void {
    this.onPollCallback = callback;
  }

  /**
   * Polls the Render API for services that are currently deploying.
   */
  private async poll(): Promise<void> {
    const credentials = await getRenderCredentials();

    if (!credentials.apiPass) {
      console.error('Render API not initialized. Call init() before polling.');
      return;
    }

    try {
      // Assuming getServices returns an array of service objects containing a status property.
      const services = await getServices(credentials.apiPass);
      // console.log(services)
      const now = new Date();
      // changed in the last hour, and is a service
      const worthLookingAt = services.filter((service) => {
        if(service.type !== 'web_service') return false;
        const lastUpdated = new Date(service.updatedAt);
        return lastUpdated.getTime() > now.getTime() - 1000 * 60 * 60 * 1;
      });

      const allDeploys: { service: Service, deploy: RenderDeploy["deploy"] }[] = []

      if (worthLookingAt.length > 0) {
        console.log('Deploying services:');
        for (const service of worthLookingAt) {

          console.log(`- Recently changed service: ${service.id}`);
          const details = await renderGet<RenderDeploy[]>(credentials.apiPass, `services/${service.id}/deploys`, {
            limit: '20',
            status: 'build_in_progress',
          });
          if (details.length === 0) console.log("   No live deploys")
          else {
            console.log("   Live deploys:")
            for (const deploy of details) {
              console.log(`    - ${JSON.stringify(deploy) }`)
              allDeploys.push({ service, deploy: deploy.deploy })
            }
          }
        }

      } else {
        console.log('No services are currently deploying.');
      }
      // Call the callback with the filtered services if it exists
      if (this.onPollCallback) {
        this.onPollCallback(allDeploys);
      }
    } catch (error) {
      console.error('Error during poll:', error);
    }
  }

  /**
   * Starts polling the Render API at the specified interval.
   */
  public start(): void {
    if (this.timerId) {
      console.warn('RenderPoller is already running.');
      return;
    }
    console.log('Starting RenderPoller...');
    this.timerId = setInterval(() => this.poll(), this.interval);
  }

  /**
   * Stops the polling process.
   */
  public stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
      console.log('RenderPoller stopped.');
    }
  }
}

export interface RenderDeploy {
  deploy: Deploy;
  cursor: string;
}

export interface Deploy {
  id:         string;
  commit:     Commit;
  status:     string;
  trigger:    string;
  createdAt:  Date;
  updatedAt:  Date;
  finishedAt: null;
}

export interface Commit {
  id:        string;
  message:   string;
  createdAt: Date;
}
