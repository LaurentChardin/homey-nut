'use strict';

/**
 * Determine if the given value is "blank".
 *
 * @param  value
 * @return boolean
 */
export const blank = function blank(value : any) {
  if (typeof value === 'undefined') {
    return true;
  }

  if (value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  if (typeof value === 'boolean' || typeof value === 'number') {
    return false;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length === 0;
  }

  if (typeof value === 'function') {
    return false;
  }

  return false;
};

/**
 * Determine if the given value is "filled".
 *
 * @param  value
 * @return boolean
 */
export const filled = function filled(value : any) {
  return !blank(value);
};

export interface UpsStatusValue {
  name: string;
  measure_battery: number | null;
  measure_battery_runtime: number | null;
  measure_temperature: number | null;
  id: string;
  measure_voltage: {
    input : number | null, 
    output: number | null,
    [key: string]: any;
  };
  measure_power: number | null;
  measure_load: number | null;
  status: string;
  alarm_status: boolean;
  [key: string]: any;
}

export interface UpsStatusResult {
  capabilities: string[];
  values: UpsStatusValue;
}

export const parseUPSStatus = (body : any) : UpsStatusResult => {
  enum STATE_TYPES {
    OL = 'Online',
    OB = 'On Battery',
    LB = 'Low Battery',
    HB = 'High Battery',
    RB = 'Battery Needs Replaced',
    CHRG = 'Battery Charging',
    DISCHRG = 'Battery Discharging',
    BYPASS = 'Bypass Active',
    CAL = 'Runtime Calibration',
    OFF = 'Offline',
    OVER = 'Overloaded',
    TRIM = 'Trimming Voltage',
    BOOST = 'Boosting Voltage',
    FSD = 'Forced Shutdown',
    ALARM = 'Alarm',
  };

  const _capabilities = [];
  const notCapabilities = new Set(['name', 'id']);

  // battery.type
  // ups.type
  // input.transfer.high Low voltage transfer point (V)
  // input.transfer.low High voltage transfer point (V)
  // ups.realpower           : "Current value of real power (Watts)"
  // ups.power               : "Current value of apparent power (Volt-Amps)".
  // ups.power.nominal       : (VA)
  // ups.load Load on UPS (percent)

  // Power Factor = Real Power (kW) / Apparent Power (kVA)
  const _values : UpsStatusValue = {
    name: filled(body['ups.model']) ? body['ups.model'] : null, // device.model ?
    id: filled(body['ups.serial']) ? body['ups.serial'] : null,
    measure_battery: filled(body['battery.charge']) ? parseInt(body['battery.charge'], 10) : null,
    measure_battery_runtime: filled(body['battery.runtime']) ? parseInt(body['battery.runtime'], 10) : null,
    measure_temperature: filled(body['battery.temperature']) ? parseFloat(body['battery.temperature']) : null,
    measure_voltage: {
      input: filled(body['input.voltage']) ? parseInt(body['input.voltage'], 10) : null,
      output: filled(body['output.voltage']) ? parseInt(body['output.voltage'], 10) : null,
    },
    status: filled(body['ups.status']) ? body['ups.status'] : null,
    alarm_status: false,
    measure_power: filled(body['ups.realpower']) ? parseFloat(body['ups.realpower']) : null,
    measure_load: filled(body['ups.load']) ? parseFloat(body['ups.load']) : null,
  };

  if (filled(_values.status)) {
    let readableStatus = '';
    _values.alarm_status = !_values.status.startsWith('OL');

    // eslint-disable-next-line no-return-assign
    _values.status.split(' ').forEach((word) => readableStatus += `${STATE_TYPES[word as keyof typeof STATE_TYPES]}, `);
    // Remove trailing comma from status readable
    readableStatus = readableStatus.replace(/,\s*$/, '');

    _values.status = readableStatus;
  }

  /* Set the capabilities list */
  for (const [key, value] of Object.entries(_values)) {
    if (filled(value) && !notCapabilities.has(key)) {
      if (value instanceof Object) {
        for (const [subKey, subValue] of Object.entries(value)) {
          if (filled(subValue)) {
            _capabilities.push(`${[key]}.${[subKey]}`);
          }
        }
      } else {
        _capabilities.push(key);
      }
    }
  }

  const result : UpsStatusResult = {
    capabilities: _capabilities,
    values: _values
  };

  return result;
};
