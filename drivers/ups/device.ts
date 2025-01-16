'use strict';

import Homey from 'homey';
import { NUTClient, Monitor } from 'nut-client'

import { parseUPSStatus, UpsStatusResult, UpsStatusValue } from '../../lib/Utils';

module.exports = class UPSDevice extends Homey.Device {

  private nut? : NUTClient;
	private id: string = '';
  private upsname: string = '';
	private name: string = '';

  private monitor? : Monitor;
  private interval?: NodeJS.Timeout;

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    // @ts-ignore
		this.id = this.getData().id;
    this.upsname = this.getData().name;
		this.name = this.getName();

    //this.nut = new NUTClient(this.getSetting('ip'), parseInt(this.getSetting('port'), 10));
    const updateInterval = Number(this.getSetting('interval')) * 1000;

    // Support monitor event ?
    // this.monitor = new Monitor(this.nut, 'myUps', {pollFrequency: updateInterval});
    // await this.monitor.start();

    this.log(`[${this.name}][${this.id}]`, `Update Interval: ${updateInterval}`);
    this.log(`[${this.name}][${this.id}]`, 'Connected to device');

    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);

    this.log('UPS device has been initialized');
  }

  async getDeviceData() {

    this.log(`[${this.name}][${this.id}]`, 'Refresh device');

    this.nut = new NUTClient(this.getSetting('ip'), parseInt(this.getSetting('port'), 10));

    const UpsVariables = await this.nut?.listVariables(this.upsname);
    const ParsedResults = parseUPSStatus(UpsVariables);
    this.setCapabilities(ParsedResults);

    this.nut.logout();

    this.log('getDeviceData End');
  }

  setCapabilities(status : UpsStatusResult) {
  
    const firstRun = this.getStoreValue('first_run');
    const deviceCapabilities = this.getStoreValue('capabilities');

    if (firstRun != null && firstRun) {
      /*
      * Go through all capabilities on the driver and remove those not supported by device.
      */
      this.log('Running setCapabilities for the first time');
      const allCapabilities = this.getCapabilities();
      allCapabilities.forEach((capability) => {
        if (!deviceCapabilities.includes(capability)) {
          this.removeCapability(capability);
          this.log(`Removing capability not supported by device [${capability}]`);
        }
      });
      this.setStoreValue('first_run', false);
    }

    const capabilityList = deviceCapabilities == null ? status.capabilities : deviceCapabilities;
    
    capabilityList.forEach((capability: string) => {
      const isSubCapability = capability.split('.').length > 1;
      if (isSubCapability) {
        const capabilityName = capability.split('.')[0];
        const subCapabilityName = capability.split('.').pop();
        if (subCapabilityName)
          this.updateValue(`${[capabilityName]}.${[subCapabilityName]}`, status.values[capabilityName][subCapabilityName]);
      } else {
        this.updateValue(capability, status.values[capability]);
      }
    });
  }

  updateValue(capability: string, value: any) {
    this.log(`Setting capability [${capability}] value to: ${value}`);
    this.setCapabilityValue(capability, value)
      .catch(this.error);
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('device added');
    this.log('name:', this.getName());
    this.log('class:', this.getClass());
    this.log('data', this.getData());
    this.log('capabilities', this.getStoreValue('capabilities'));
  }

  /**
   * onSettings is called when the user updates the device's settings.
   * @param {object} event the onSettings event data
   * @param {object} event.oldSettings The old settings object
   * @param {object} event.newSettings The new settings object
   * @param {string[]} event.changedKeys An array of keys changed since the previous version
   * @returns {Promise<string|void>} return a custom message that will be displayed
   */
  async onSettings({
    oldSettings,
    newSettings,
    changedKeys,
  }: {
    oldSettings: { [key: string]: boolean | string | number | undefined | null };
    newSettings: { [key: string]: boolean | string | number | undefined | null };
    changedKeys: string[];
  }): Promise<string | void> {
    for (const name of changedKeys) {
      /* Log setting changes except for password */
      if (name !== 'password') {
        this.log(`Setting '${name}' set '${oldSettings[name]}' => '${newSettings[name]}'`);
      }
    }
    if (oldSettings.interval !== newSettings.interval && typeof newSettings.interval == 'number') {
      this.log(`Delete old interval of ${oldSettings.interval}s and creating new ${newSettings.interval}s`);
      clearInterval(this.interval);
      this.setUpdateInterval(newSettings.interval);
    }
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name : string) {
    this.log(`${name} renamed`);
  }

  setUpdateInterval(newInterval : number) {
    const updateInterval = Number(newInterval) * 1000;
    this.log(`Creating update interval with ${updateInterval}`);

    this.interval = setInterval(async () => {
      await this.getDeviceData();
    }, updateInterval);
  
    // TODO: update monitor ?
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    // TODO : kill monitor ?
    // await this.monitor?.stop();

    clearInterval(this.interval);
    await this.nut?.logout();

    this.log(`${this.name} deleted`);
  }

}
