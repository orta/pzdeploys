import { getServices, renderGet } from '@llimllib/renderapi';
import keytar from 'keytar';

async function getRenderCredentials() {
  // Retrieve the username stored in keytar for the render service
  const apiPass = await keytar.getPassword('pzdeploys', 'renderApiPassword');
  if (!apiPass) {
    throw new Error('Render username not found in keytar');
  }
  
  return {  apiPass };
}

export class RenderPoller {
  private interval: number;
  private timerId: NodeJS.Timeout | null = null;
  private onPollCallback?: (services: any[]) => void;

  constructor(intervalSeconds: number = 5) { // default poll every 30 seconds
    this.interval = intervalSeconds * 1000;
  }

  /**
   * Sets a callback function to be called after each successful poll
   * @param callback Function to be called with the filtered services
   */
  public setCallback(callback: (services: any[]) => void): void {
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

      const allDeploys: any[] = []

      if (worthLookingAt.length > 0) {
        console.log('Deploying services:');
        for (const service of worthLookingAt) {

          console.log(`- Recently changed service: ${service.id}`);
          const details = await renderGet<any[]>(credentials.apiPass, `services/${service.id}/deploys`, {
            limit: '20',
            status: 'build_in_progress',
          });
          if (details.length === 0) console.log("   No live deploys")
          else {
            console.log("   Live deploys:")
            for (const deploy of details) {
              console.log(`    - ${deploy.id}`)
            }
            allDeploys.push(...details)
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