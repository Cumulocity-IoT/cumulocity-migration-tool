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
import { DataClient } from 'src/DataClient';
import { UpdateableAlert } from "../../utils/UpdateableAlert";
import { ActionControl, AlertService, Column, DataGridComponent, Pagination } from "@c8y/ngx-components";
import { difference } from 'lodash';

@Component({
    templateUrl: './simulator.component.html'
})
export class SimulatorComponent implements OnInit {
    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allSimulators: IManagedObject[];

    selectedSimulatorIds: string[] = [];

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
            text: 'View in Device Management',
            type: 'ACTION',
            icon: 'bot',
            callback: ((simulator: IManagedObject) => this.viewSimulator(simulator))
        },
        {
            text: 'View Managed Object',
            type: 'ACTION',
            icon: 'file',
            callback: ((simulator: IManagedObject) => this.viewManagedObject(simulator))
        }
    ];

    constructor(private dataService: DataService, private selectionService: SelectionService,
        private alertService: AlertService) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.initSelectedSimulators();
    }

    private async load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allSimulators = await this.dataClient.getSimulators().then(d => sortById(d));
    }

    private initSelectedSimulators(): void {
        this.allSimulators.forEach((simulator) => {
            if (this.isSelected(simulator.id)) {
                this.selectedSimulatorIds.push(simulator.id);
            }
        });

        this.dataGrid.setItemsSelected(this.selectedSimulatorIds, true);
    }

    onSimulatorsSelected(selectedSimulatorIds): void {
        selectedSimulatorIds.forEach((selectedSimulatorId) => {
            if (!this.isSelected(selectedSimulatorId)) {
                this.selectSimulator(selectedSimulatorId);
            }
        });

        const simulatorsToDeselect = difference(this.selectedSimulatorIds, selectedSimulatorIds);
        this.selectedSimulatorIds = selectedSimulatorIds;

        simulatorsToDeselect.forEach(simulatorToDeselect => this.selectionService.deselect(simulatorToDeselect));
    }

    private async selectSimulator(simulatorId: string): Promise<void> {
        const alrt = new UpdateableAlert(this.alertService);
        this.selectionService.select(simulatorId);
        alrt.update(`Searching for linked Groups and Devices...`);
        const simulator: IManagedObject = this.allSimulators.find((simulator) => simulator.id === simulatorId);
        const { groups, devices, simulators, smartRules, other, childParentLinks } = await this.dataClient.findLinkedFrom(simulator);
        childParentLinks.forEach(({ child, parent }) => {
            this.selectionService.select(child, parent);
        });
        alrt.update(`Links found: ${groups.length} Groups, ${devices.length} Devices, ${simulators.length - 1} Simulators, ${smartRules.length} Smart Rules, ${other.length} Other`);
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

    private viewSimulator(simulator: IManagedObject) {
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/devicemanagement/index.html#/simulators/${simulator.id}`, '_blank');
    }
}
