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
import { IManagedObject } from '@c8y/client';
import { DataService } from "../../data.service";
import { SelectionService } from "../../selection.service";
import { delay, sortById } from "../../utils/utils";
import { UpdateableAlert } from "../../utils/UpdateableAlert";
import { ActionControl, AlertService, Column, DataGridComponent, Pagination } from "@c8y/ngx-components";
import { DataClient } from 'src/DataClient';
import download from "downloadjs";
import { difference } from 'lodash';

@Component({
    templateUrl: './binary.component.html'
})
export class BinaryComponent implements OnInit {
    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allBinaries: IManagedObject[];

    selectedBinaryIds: string[] = [];

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
            name: 'size',
            header: 'Size',
            path: 'length',
            sortable: false,
            filterable: false,
        }
    ];

    pagination: Pagination = {
        pageSize: 20,
        currentPage: 1,
    };

    actionControls: ActionControl[] = [
        {
            text: 'Download Binary',
            type: 'ACTION',
            icon: 'download-archive',
            callback: ((binary: IManagedObject) => this.downloadBinary(binary))
        },
        {
            text: 'View Managed Object',
            type: 'ACTION',
            icon: 'file',
            callback: ((binary: IManagedObject) => this.viewManagedObject(binary))
        }
    ];

    constructor(private dataService: DataService, private selectionService: SelectionService,
        private alertService: AlertService) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.initSelectedBinaries();
    }

    private async load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allBinaries = await this.dataClient.getBinaries()
            .then(binaries => binaries.filter(b => !b.hasOwnProperty('c8y_applications_storage')))
            .then(binaries => sortById(binaries));
    }

    private initSelectedBinaries(): void {
        this.allBinaries.forEach((binary) => {
            if (this.isSelected(binary.id)) {
                this.selectedBinaryIds.push(binary.id);
            }
        });

        this.dataGrid.setItemsSelected(this.selectedBinaryIds, true);
    }

    onBinariesSelected(selectedBinaryIds): void {
        selectedBinaryIds.forEach((selectedBinaryId) => {
            if (!this.isSelected(selectedBinaryId)) {
                this.selectBinary(selectedBinaryId);
            }
        });

        const binariesToDeselect = difference(this.selectedBinaryIds, selectedBinaryIds);
        this.selectedBinaryIds = selectedBinaryIds;

        binariesToDeselect.forEach(binaryToDeselect => this.selectionService.deselect(binaryToDeselect));
    }

    private async selectBinary(binaryId: string) {
        const alrt = new UpdateableAlert(this.alertService);
        this.selectionService.select(binaryId);
        alrt.update(`Searching for linked Groups and Devices...`);
        const binary = this.allBinaries.find(binary => binary.id === binaryId);
        const { groups, devices, simulators, smartRules, other, childParentLinks } = await this.dataClient.findLinkedFrom(binary);
        childParentLinks.forEach(({ child, parent }) => {
            this.selectionService.select(child, parent);
        });
        alrt.update(`Links found: ${groups.length} Groups, ${devices.length} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${other.length} Other`);
        alrt.close(5000);
    }

    private isSelected(id: string) {
        return this.selectionService.isSelected(id);
    }

    private viewManagedObject(managedObject: IManagedObject) {
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    private async downloadBinary(binary: IManagedObject) {
        const downloadAlert = new UpdateableAlert(this.alertService);
        const blob = await this.dataClient.getBinaryBlob(binary, progress => {
            downloadAlert.update(`Downloading... ${(progress * 100).toFixed(0)}%`);
        });
        downloadAlert.update('Opening...');
        download(blob, binary.name);
        await delay(4000);
        downloadAlert.close();
    }
}
