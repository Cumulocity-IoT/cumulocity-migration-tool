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
import { DataClient } from 'src/DataClient';
import { difference } from 'lodash';

@Component({
    templateUrl: './other.component.html'
})
export class OtherComponent implements OnInit {
    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allOtherManagedObjects: IManagedObject[];

    selectedManagedObjectsIds: string[] = [];

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
            path: 'name'
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
            text: 'View Managed Object',
            type: 'ACTION',
            icon: 'file',
            callback: ((managedObject: IManagedObject) => this.viewManagedObject(managedObject))
        }
    ];

    constructor(private dataService: DataService, private selectionService: SelectionService,
        private alertService: AlertService) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.initSelectedManagedObjects();
    }

    private async load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allOtherManagedObjects = await this.dataClient.getOtherManagedObjects().then(d => sortById(d));
    }

    private initSelectedManagedObjects(): void {
        this.allOtherManagedObjects.forEach((managedObject) => {
            if (this.isSelected(managedObject.id)) {
                this.selectedManagedObjectsIds.push(managedObject.id);
            }
        });

        this.dataGrid.setItemsSelected(this.selectedManagedObjectsIds, true);
    }

    onManagedObjectsSelected(selectedManagedObjectsIds): void {
        selectedManagedObjectsIds.forEach((selectedManagedObjectId) => {
            if (!this.isSelected(selectedManagedObjectId)) {
                this.selectManagedObject(selectedManagedObjectId);
            }
        });

        const managedObjectToDeselect = difference(this.selectedManagedObjectsIds, selectedManagedObjectsIds);
        this.selectedManagedObjectsIds = selectedManagedObjectsIds;

        managedObjectToDeselect.forEach(managedObjectToDeselect => this.selectionService.deselect(managedObjectToDeselect));
    }

    private async selectManagedObject(managedObjectId: string): Promise<void> {
        const alrt = new UpdateableAlert(this.alertService);
        this.selectionService.select(managedObjectId);
        alrt.update(`Searching for linked Groups and Devices...`);
        const managedObject = this.allOtherManagedObjects.find(managedObject => managedObject.id === managedObjectId);
        const { groups, devices, simulators, smartRules, other, childParentLinks } = await this.dataClient.findLinkedFrom(managedObject);
        childParentLinks.forEach(({ child, parent }) => {
            this.selectionService.select(child, parent);
        });
        alrt.update(`Links found: ${groups.length} Groups, ${devices.length} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${other.length - 1} Other`);
        alrt.close(5000);
    }

    isSelected(id: string) {
        return this.selectionService.isSelected(id);
    }

    getName(name: string) {
        return name || '-';
    }

    private viewManagedObject(managedObject: IManagedObject) {
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }
}
