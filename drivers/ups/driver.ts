'use strict';

import Homey from 'homey';
import { NUTClient, Monitor, UPS } from 'nut-client'

import { parseUPSStatus, UpsStatusResult, UpsStatusValue } from '../../lib/Utils';

interface dataSettings {
  ip: string,
  port: number,
  interval: number,
  username: string,
  password: string
}

module.exports = class UPSDriver extends Homey.Driver {

  private nut? : NUTClient;

  /**
 * onInit is called when the driver is initialized.
 */
  async onInit() {
    this.log('UPSDriver has been initialized');
  }

    
  // Pairing
  async onPair(session: Homey.Driver.PairSession) {
    this.log('UPSDriver Pairing started');
    const foundDevices : any = [];

    // Triggerd on Start form loading
    session.setHandler('getSettings', async ()  => {
      return {
        ip: this.homey.settings.get('ip'),
        port: this.homey.settings.get('port'),
        interval: this.homey.settings.get('interval'),
        username: this.homey.settings.get('username'),
        password: this.homey.settings.get('password'),
      };
    });

    // Connect triggered by Start form
    // TODO: argument typing
    session.setHandler('connect', async (data) => {
      this.log('Connecting to server');

      try {
        const settings = data;

        this.nut = new NUTClient(settings.ip, parseInt(settings.port, 10));
        // username / password : settings.username, settings.password
        // error event ?
        // close event ?

        this.log('Requesting list of active devices..');
        const UPS = await this.nut.listUPS();

        for (const up of UPS) {
          foundDevices.push(await this.getDeviceData(up, settings));
        }

        this.log('Saving settings');
        this._saveSettings(settings);

        // catch error ?
        // close
        this.nut.logout();

      } catch (err : any) {
        this.log(`There was an error: ${err.message}`);
      }
    });

    session.setHandler('list_devices', async () => {
      return Promise.resolve(foundDevices);
    });
  }

 _saveSettings(data : dataSettings) {
    this.homey.settings.set('ip', data.ip);
    this.homey.settings.set('port', data.port);
    this.homey.settings.set('interval', data.interval);
    this.homey.settings.set('username', data.username);
    this.homey.settings.set('password', data.password);
  }

  async getDeviceData(ups : UPS, settings : dataSettings) {
    let device = {};

    this.log('Requesting UPS data for:', ups.name);
    const result = await this.nut?.listVariables(ups.name)
      .then((res) => res)
      .catch((err) => this.log(err));

    if (result) {
      this.log('List Variable Response:', result);

      const status : UpsStatusResult = parseUPSStatus(result);

      device = {
        name: status.values?.name,
        data: {
          name: ups.name,
          id: status.values?.id,
        },
        settings: {
          ip: settings.ip,
          port: Number(settings.port) || 3493,
          interval: settings.interval,
          username: settings.username,
          password: settings.password,
        },
        store: {
          capabilities: status.capabilities,
          first_run: true,
        },
      };
    }
    
    return device;
  }

}