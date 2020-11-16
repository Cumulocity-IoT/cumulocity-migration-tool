/*
* Copyright (c) 2019 Software AG, Darmstadt, Germany and/or its licensors
*
* SPDX-License-Identifier: Apache-2.0
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
*    http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
 */
import {Component} from '@angular/core';
import {IManagedObject, Client} from '@c8y/client';
import {DataService} from "../../data.service";
import {SelectionService} from "../../selection.service";
import {isSimulatorDevice, sortById} from "../../utils/utils";
import {UpdateableAlert} from "../../utils/UpdateableAlert";
import {AlertService} from "@c8y/ngx-components";
import {DataClient} from 'src/DataClient';

@Component({
    templateUrl: './device.component.html'
})
export class DeviceComponent {
    private dataClient: DataClient;
    allDevices: Promise<IManagedObject[]>;

    constructor(private dataService: DataService, private selectionService: SelectionService, private alertService: AlertService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allDevices = this.dataClient.getDevices().then(d => sortById(d));
    }

    async toggleSelection(device: IManagedObject) {
        if (this.isSelected(device)) {
            this.selectionService.deselect(device.id);
        } else {
            const alrt = new UpdateableAlert(this.alertService);
            this.selectionService.select(device.id);
            alrt.update(`Searching for linked Groups and Devices...`);
            const {groups, devices, simulators, smartRules, other, childParentLinks} = await this.dataClient.findLinkedFrom(device);
            childParentLinks.forEach(({child, parent}) => {
                this.selectionService.select(child, parent);
            });
            alrt.update(`Links found: ${groups.length} Groups, ${devices.length-1} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${other.length} Other`);
            alrt.close(5000);
        }
    }

    isSimulated(device: IManagedObject): boolean {
        return isSimulatorDevice(device);
    }

    isSelected(o: {id: string|number}) {
        return this.selectionService.isSelected(o.id);
    }

    trackById(index, value) {
        return value.id;
    }

    getDeviceName(device: IManagedObject) {
        return device.name || '-';
    }

    viewManagedObject(event: MouseEvent, managedObject: IManagedObject) {
        event.stopPropagation();
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    viewDeviceManagement(event: MouseEvent, device: IManagedObject) {
        event.stopPropagation();
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/devicemanagement/index.html#/device/${device.id}/device-info`, '_blank');
    }

    viewCockpit(event: MouseEvent, device: IManagedObject) {
        event.stopPropagation();
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/cockpit/index.html#/device/${device.id}/info`, '_blank');
    }


    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }

    async selectAll() {
        this.allDevices.then((devices) => {
            devices.forEach(device => {
                if (this.isSelected(device)) {
                    return;
                }

                this.toggleSelection(device);
            });
        });
    }

    async deselectAll() {
        this.allDevices.then((devices) => {
            devices.forEach(device => {
                if (!this.isSelected(device)) {
                    return;
                }

                this.toggleSelection(device);
            });
        });
    }
}
