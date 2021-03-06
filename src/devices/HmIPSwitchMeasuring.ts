import {
    CharacteristicGetCallback,
    CharacteristicSetCallback,
    CharacteristicValue,
    PlatformAccessory,
    Service
} from 'homebridge';

import {HmIPPlatform} from '../HmIPPlatform';
import {HmIPDevice, HmIPGroup, Updateable} from '../HmIPState';
import {HmIPGenericDevice} from './HmIPGenericDevice';
import {ElectricPower, ElectricalEnergy} from "../EveCharacteristics";

interface SwitchMeasuringChannel {
    functionalChannelType: string;
    on: boolean;
    profileMode: string;
    userDesiredProfileMode: string;
    energyCounter: number;
    currentPowerConsumption: number;
}

/**
 * HomematicIP switch (measuring)
 *
 * HMIP-PSM (Pluggable Switch and Meter)
 * HMIP-BSM (Brand Switch and Meter)
 * HMIP-FSM, HMIP-FSM16 (Full flush Switch and Meter)
 *
 */
export class HmIPSwitchMeasuring extends HmIPGenericDevice implements Updateable {
    private service: Service;

    private on: boolean = false;
    private energyCounter: number = 0;
    private currentPowerConsumption: number = 0;

    constructor(
        platform: HmIPPlatform,
        accessory: PlatformAccessory,
    ) {
        super(platform, accessory);

        this.platform.log.debug(`Created switch (measuring) ${accessory.context.device.label}`);
        this.service = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);
        this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.label);

        this.updateDevice(accessory.context.device, platform.groups);

        this.service.getCharacteristic(this.platform.Characteristic.On)
          .on('get', this.handleOnGet.bind(this))
          .on('set', this.handleOnSet.bind(this));

        this.service.getCharacteristic(ElectricPower)
          .on('get', this.handleElectricPowerGet.bind(this));

        this.service.getCharacteristic(ElectricalEnergy)
          .on('get', this.handleElectricalEnergyGet.bind(this));
    }

    handleOnGet(callback: CharacteristicGetCallback) {
        callback(null, this.on);
    }

    async handleOnSet(value: CharacteristicValue, callback: CharacteristicSetCallback) {
        this.platform.log.info("Setting switch %s to %s", this.accessory.displayName, value ? "on" : "off");
        const body = {
            channelIndex: 1,
            deviceId: this.accessory.context.device.id,
            on: value,
        };
        await this.platform.connector.apiCall('device/control/setSwitchState', body);
        callback(null);
    }

    handleElectricPowerGet(callback: CharacteristicGetCallback) {
        callback(null, this.currentPowerConsumption);
    }

    handleElectricalEnergyGet(callback: CharacteristicGetCallback) {
        callback(null, this.energyCounter);
    }

    public updateDevice(hmIPDevice: HmIPDevice, groups: { [key: string]: HmIPGroup }) {
        super.updateDevice(hmIPDevice, groups);
        for (const id in hmIPDevice.functionalChannels) {
            const channel = hmIPDevice.functionalChannels[id];
            if (channel.functionalChannelType == "SWITCH_MEASURING_CHANNEL") {
                const switchMeasuringChannel = <SwitchMeasuringChannel>channel;
                this.platform.log.debug(`Switch (measuring) update: ${JSON.stringify(channel)}`);

                if (switchMeasuringChannel.on != this.on) {
                    this.on = switchMeasuringChannel.on;
                    this.platform.log.info("Switch state of %s changed to %s", this.accessory.displayName, this.on ? "on" : "off");
                    this.service.updateCharacteristic(this.platform.Characteristic.On, this.on);
                }

                if (switchMeasuringChannel.currentPowerConsumption != null && switchMeasuringChannel.currentPowerConsumption != this.currentPowerConsumption) {
                    this.currentPowerConsumption = switchMeasuringChannel.currentPowerConsumption;
                    this.platform.log.info("Switch power consumption of %s changed to %s", this.accessory.displayName, this.currentPowerConsumption);
                    this.service.updateCharacteristic(ElectricPower, this.currentPowerConsumption);
                }

                if (switchMeasuringChannel.energyCounter != null && switchMeasuringChannel.energyCounter != this.energyCounter) {
                    this.energyCounter = switchMeasuringChannel.energyCounter;
                    this.platform.log.info("Switch energy counter of %s changed to %s", this.accessory.displayName, this.energyCounter);
                    this.service.updateCharacteristic(ElectricalEnergy, this.energyCounter);
                }
            }
        }
    }
}
