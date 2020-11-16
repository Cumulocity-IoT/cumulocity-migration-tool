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
import { Component } from '@angular/core';
import { IManagedObject } from '@c8y/client';
import { DataService } from "../../data.service";
import { SelectionService } from "../../selection.service";
import { delay, sortById } from "../../utils/utils";
import { UpdateableAlert } from "../../utils/UpdateableAlert";
import { AlertService } from "@c8y/ngx-components";
import { DataClient } from 'src/DataClient';
import download from "downloadjs";

@Component({
    templateUrl: './binary.component.html'
})
export class BinaryComponent {
    private dataClient: DataClient;
    allBinaries: Promise<IManagedObject[]>;

    constructor(private dataService: DataService, private selectionService: SelectionService, private alertService: AlertService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allBinaries = this.dataClient.getBinaries()
            .then(binaries => binaries.filter(b => !b.hasOwnProperty('c8y_applications_storage')))
            .then(binaries => sortById(binaries));
    }

    async toggleSelection(binary: IManagedObject) {
        if (this.isSelected(binary)) {
            this.selectionService.deselect(binary.id);
        } else {
            const alrt = new UpdateableAlert(this.alertService);
            this.selectionService.select(binary.id);
            alrt.update(`Searching for linked Groups and Devices...`);
            const { groups, devices, simulators, smartRules, other, childParentLinks } = await this.dataClient.findLinkedFrom(binary);
            childParentLinks.forEach(({ child, parent }) => {
                this.selectionService.select(child, parent);
            });
            alrt.update(`Links found: ${groups.length} Groups, ${devices.length} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${other.length} Other`);
            alrt.close(5000);
        }
    }

    isSelected(o: { id: string | number }) {
        return this.selectionService.isSelected(o.id);
    }

    trackById(index, value) {
        return value.id;
    }

    getName(binary: IManagedObject) {
        return binary.name || '-';
    }

    viewManagedObject(event: MouseEvent, managedObject: IManagedObject) {
        event.stopPropagation();
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    async downloadBinary(event: MouseEvent, binary: IManagedObject) {
        event.stopPropagation();
        const downloadAlert = new UpdateableAlert(this.alertService);
        const blob = await this.dataClient.getBinaryBlob(binary, progress => {
            downloadAlert.update(`Downloading... ${(progress * 100).toFixed(0)}%`);
        });
        downloadAlert.update('Opening...');
        download(blob, binary.name);
        await delay(4000);
        downloadAlert.close();
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }

    async selectAll() {
        this.allBinaries.then((eplFiles) => {
            eplFiles.forEach(eplFile => {
                if (this.isSelected(eplFile)) {
                    return;
                }

                this.toggleSelection(eplFile);
            });
        });
    }

    async deselectAll() {
        this.allBinaries.then((eplFiles) => {
            eplFiles.forEach(eplFile => {
                if (!this.isSelected(eplFile)) {
                    return;
                }

                this.toggleSelection(eplFile);
            });
        });
    }
}
