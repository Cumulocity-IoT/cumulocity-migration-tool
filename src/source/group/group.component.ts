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
import { sortById } from "../../utils/utils";
import { UpdateableAlert } from "../../utils/UpdateableAlert";
import { ActionControl, AlertService, Column, DataGridComponent, Pagination } from "@c8y/ngx-components";
import { DataClient } from "../../DataClient";
import { difference } from 'lodash';

@Component({
    templateUrl: './group.component.html'
})
export class GroupComponent implements OnInit {
    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allGroups: IManagedObject[];

    selectedGroupIds: string[] = [];

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
            callback: ((group: IManagedObject) => this.viewCockpit(group))
        },
        {
            text: 'View in Device Management',
            type: 'ACTION',
            callback: ((group: IManagedObject) => this.viewDeviceManagement(group))
        },
        {
            text: 'View Managed Object',
            type: 'ACTION',
            callback: ((group: IManagedObject) => this.viewManagedObject(group))
        }
    ];

    constructor(private dataService: DataService, private selectionService: SelectionService,
        private alertService: AlertService) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.updateSelectedGroups();
    }

    async load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allGroups = await this.dataClient.getGroups().then(g => sortById(g));
    }

    updateSelectedGroups(): void {
        this.allGroups.forEach((group) => {
            if (this.isSelected(group.id)) {
                this.selectedGroupIds.push(group.id);
            }
        });

        this.dataGrid.setItemsSelected(this.selectedGroupIds, true);
    }

    async selectGroup(groupId: string): Promise<void> {
        const alrt = new UpdateableAlert(this.alertService);
        this.selectionService.select(groupId);
        alrt.update(`Searching for linked Groups and Devices...`);
        const groupRepresentation = this.allGroups.find((group) => group.id === groupId);
        const { groups, devices, simulators, smartRules, other, childParentLinks } = await this.dataClient.findLinkedFrom(groupRepresentation);
        childParentLinks.forEach(({ child, parent }) => {
            this.selectionService.select(child, parent);
        });

        console.log('select group, groups: ', groups);
        console.log('select group, groups: ', devices);
        this.updateSelectedGroups();

        alrt.update(`Links found: ${groups.length - 1} Groups, ${devices.length} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${other.length} Other`);
        alrt.close(5000);
    }

    isSelected(groupId: string) {
        return this.selectionService.isSelected(groupId);
    }

    viewManagedObject(managedObject: IManagedObject) {
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    viewDeviceManagement(group: IManagedObject) {
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/devicemanagement/index.html#/group/${group.id}/group-info`, '_blank');
    }

    viewCockpit(group: IManagedObject) {
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/cockpit/index.html#/group/${group.id}/info`, '_blank');
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }

    onGroupsSelected(selectedGroupIds): void {
        selectedGroupIds.forEach((selectedGroupId) => {
            if (!this.isSelected(selectedGroupId)) {
                this.selectGroup(selectedGroupId);
            }
        });

        const groupsToDeselect = difference(this.selectedGroupIds, selectedGroupIds);
        this.selectedGroupIds = selectedGroupIds;

        groupsToDeselect.forEach(groupToDeselect => this.selectionService.deselect(groupToDeselect));
    }
}
