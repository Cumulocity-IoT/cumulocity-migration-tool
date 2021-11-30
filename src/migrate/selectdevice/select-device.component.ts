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
import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from "@angular/core";
import { DataClient } from "../../DataClient";
import { DataService } from "../../data.service";
import { ActionControl, AlertService, Column, DataGridComponent, Pagination } from "@c8y/ngx-components";
import { isSimulatorDevice, sortById } from "../../utils/utils";
import { IManagedObject } from "@c8y/client";
import { BsModalRef } from "ngx-bootstrap/modal";
import { difference } from "lodash";
import { Subject } from "rxjs";

@Component({
    templateUrl: './select-device.component.html',
    selector: 'selectDevice'
})
export class SelectDeviceComponent implements OnInit {
    @Input() selected: string;

    onClose: Subject<string> = new Subject();

    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allDevices: IManagedObject[];

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
    ];

    constructor(private dataService: DataService, private modalRef: BsModalRef) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.initSelectedDevice();
    }

    async load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allDevices = await this.dataClient.getDevices().then(d => sortById(d));
    }

    initSelectedDevice(): void {
        this.dataGrid.selectedItemIds = [this.selected];
    }

    isDeviceSelected(): boolean {
        return !!this.selected;
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

    onDevicesSelected(selectedDeviceIds: string[]): void {
        if (selectedDeviceIds.length === 0) {
            this.selected = undefined;
            return;
        }

        const newlySelectedDeviceId = selectedDeviceIds.find((selectedDeviceId) => selectedDeviceId != this.selected);
        if (!newlySelectedDeviceId) {
            return;
        }

        this.dataGrid.selectedItemIds = [newlySelectedDeviceId];
        this.selected = newlySelectedDeviceId;
    }

    close(success: boolean = true) {
        if (success) {
            this.onClose.next(this.selected);
        }
        
        this.modalRef.hide();
    }
}