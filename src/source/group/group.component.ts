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
import { sortById } from "../../utils/utils";
import { UpdateableAlert } from "../../utils/UpdateableAlert";
import { AlertService } from "@c8y/ngx-components";
import { DataClient } from "../../DataClient";

@Component({
    templateUrl: './group.component.html'
})
export class GroupComponent {
    private dataClient: DataClient;
    allGroups: Promise<IManagedObject[]>;

    constructor(private dataService: DataService, private selectionService: SelectionService, private alertService: AlertService) {
        this.load()
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allGroups = this.dataClient.getGroups().then(g => sortById(g));
    }

    async toggleSelection(group: IManagedObject) {
        if (this.isSelected(group)) {
            this.selectionService.deselect(group.id);
        } else {
            const alrt = new UpdateableAlert(this.alertService);
            this.selectionService.select(group.id);
            alrt.update(`Searching for linked Groups and Devices...`);
            const { groups, devices, simulators, smartRules, other, childParentLinks } = await this.dataClient.findLinkedFrom(group);
            childParentLinks.forEach(({ child, parent }) => {
                this.selectionService.select(child, parent);
            });
            alrt.update(`Links found: ${groups.length - 1} Groups, ${devices.length - 1} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${other.length} Other`);
            alrt.close(5000);
        }
    }

    isSelected(o: { id: string | number }) {
        return this.selectionService.isSelected(o.id);
    }

    trackById(index, value) {
        return value.id;
    }

    getGroupName(group: IManagedObject) {
        return group.name || '-';
    }

    viewManagedObject(event: MouseEvent, managedObject: IManagedObject) {
        event.stopPropagation();
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    viewDeviceManagement(event: MouseEvent, group: IManagedObject) {
        event.stopPropagation();
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/devicemanagement/index.html#/group/${group.id}/group-info`, '_blank');
    }

    viewCockpit(event: MouseEvent, group: IManagedObject) {
        event.stopPropagation();
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/cockpit/index.html#/group/${group.id}/info`, '_blank');
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }

    async selectAll() {
        this.allGroups.then((groups) => {
            groups.forEach(group => {
                if (this.isSelected(group)) {
                    return;
                }

                this.toggleSelection(group);
            });
        });
    }

    async deselectAll() {
        this.allGroups.then((groups) => {
            groups.forEach(group => {
                if (!this.isSelected(group)) {
                    return;
                }

                this.toggleSelection(group);
            });
        });
    }
}
