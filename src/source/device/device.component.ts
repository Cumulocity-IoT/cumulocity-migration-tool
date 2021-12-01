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
import { Component, OnInit, ViewChild } from '@angular/core';
import { IManagedObject, Client } from '@c8y/client';
import { DataService } from "../../data.service";
import { SelectionService } from "../../selection.service";
import { isSimulatorDevice, sortById } from "../../utils/utils";
import { UpdateableAlert } from "../../utils/UpdateableAlert";
import { ActionControl, AlertService, Column, DataGridComponent, Pagination, Row } from "@c8y/ngx-components";
import { DataClient } from 'src/DataClient';
import { difference } from 'lodash';
import { SimulatorCellRendererComponent } from './cell-renderer/simulator-cell-renderer.component';

@Component({
    templateUrl: './device.component.html'
})
export class DeviceComponent implements OnInit {
    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allDevices: IManagedObject[];

    selectedDeviceIds: string[] = [];

    columns: Column[] = [
        {
            name: 'id',
            header: 'ID',
            path: 'id',
            gridTrackSize: '0.5fr'
        },
        {
            name: 'name',
            header: 'Name',
            path: 'name',
            filterable: true,
        },
        {
            name: 'owner',
            header: 'Owner',
            path: 'owner',
            filterable: true,
        },
        {
            name: 'isSimulated',
            header: 'Simulated?',
            filterable: false,
            sortable: false,
            cellRendererComponent: SimulatorCellRendererComponent
        }
    ];

    pagination: Pagination = {
        pageSize: 20,
        currentPage: 1,
    };

    actionControls: ActionControl[] = [
        {
            text: 'View in Cockpit',
            type: 'ACTION',
            callback: ((device: IManagedObject) => this.viewCockpit(device))
        },
        {
            text: 'View in Device Management',
            type: 'ACTION',
            callback: ((device: IManagedObject) => this.viewDeviceManagement(device))
        },
        {
            text: 'View Managed Object',
            type: 'ACTION',
            callback: ((device: IManagedObject) => this.viewManagedObject(device))
        }
    ]

    constructor(private dataService: DataService, private selectionService: SelectionService,
        private alertService: AlertService) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.initSelectedDevices();
    }

    async load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allDevices = await this.dataClient.getDevices().then(device => sortById(device));
    }

    initSelectedDevices(): void {
        this.allDevices.forEach((device) => {
            if (this.isSelected(device.id)) {
                this.selectedDeviceIds.push(device.id);
            }
        });

        this.dataGrid.setItemsSelected(this.selectedDeviceIds, true);
    }

    async selectDevice(deviceId: string): Promise<void> {
        const alrt = new UpdateableAlert(this.alertService);
        this.selectionService.select(deviceId);
        alrt.update(`Searching for linked Groups and Devices...`);
        const deviceRepresentation: IManagedObject = this.allDevices.find(device => device.id === deviceId);
        console.log('deviceRepresentation: ', deviceRepresentation);
        const { groups, devices, simulators, smartRules, other, childParentLinks } = await this.dataClient.findLinkedFrom(deviceRepresentation);
        childParentLinks.forEach(({ child, parent }) => {
            this.selectionService.select(child, parent);
        });
        alrt.update(`Links found: ${groups.length} Groups, ${devices.length - 1} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${other.length} Other`);
        alrt.close(5000);
    }

    isSimulated(device: IManagedObject): boolean {
        return isSimulatorDevice(device);
    }

    isSelected(deviceId: string) {
        return this.selectionService.isSelected(deviceId);
    }

    trackById(index, value) {
        return value.id;
    }

    getDeviceName(device: IManagedObject) {
        return device.name || '-';
    }

    viewManagedObject(managedObject: IManagedObject) {
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    viewDeviceManagement(device: IManagedObject) {
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/devicemanagement/index.html#/device/${device.id}/device-info`, '_blank');
    }

    viewCockpit(device: IManagedObject) {
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/cockpit/index.html#/device/${device.id}/info`, '_blank');
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }

    onDevicesSelected(selectedDeviceIds): void {
        selectedDeviceIds.forEach((selectedDeviceId) => {
            if (!this.isSelected(selectedDeviceId)) {
                this.selectDevice(selectedDeviceId);
            }
        });

        const devicesToDeselect = difference(this.selectedDeviceIds, selectedDeviceIds);
        this.selectedDeviceIds = selectedDeviceIds;

        devicesToDeselect.forEach(deviceToDeselect => this.selectionService.deselect(deviceToDeselect));
    }
}
