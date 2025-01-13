'use strict';

import Homey from 'homey';
import { NUTClient, Monitor } from 'nut-client'

const { parseUPSStatus } = require('../../lib/Utils');

module.exports = class UPSDriver extends Homey.Driver {

  private nut? : NUTClient;

    /**
   * onInit is called when the driver is initialized.
   */
    async onInit() {
      this.log('MyDriver has been initialized');
    }

    
  // Pairing
  async onPair(session: Homey.Driver.PairSession) {
    this.log('Pairing started');

    session.setHandler('getSettings', async () => {
      return {
        ip: this.homey.settings.get('ip'),
        port: this.homey.settings.get('port'),
        interval: this.homey.settings.get('interval'),
        username: this.homey.settings.get('username'),
        password: this.homey.settings.get('password'),
      };
    });

    const foundDevices : any = [];

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

        for (const ups of UPS) {
          foundDevices.push(await this.getDeviceData(ups, settings));
        }

        this.saveSettings(data);

        // catch error ?
        // close
      } catch (err : any) {
        this.log(`There was an error: ${err.message}`);
      }
    });

    session.setHandler('list_devices', async () => {
      return Promise.resolve(foundDevices);
    });
  }

  saveSettings(data) {
    this.homey.settings.set('ip', data.ip);
    this.homey.settings.set('port', data.port);
    this.homey.settings.set('interval', data.interval);
    this.homey.settings.set('username', data.username);
    this.homey.settings.set('password', data.password);
  }

  async getDeviceData(name, settings) {
    let device = {};
    this.log('Requesting UPS data for:', name);
    const result = await this.nut.GetUPSVars(name)
      .then((res) => res)
      .catch((err) => this.log(err));

    if (result) {
      this.log('Response:', result);

      const status = parseUPSStatus(result);
      device = {
        name: status.values.name,
        data: {
          name,
          id: status.values.id,
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