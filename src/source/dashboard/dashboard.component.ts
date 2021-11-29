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
import { CredentialsService } from "../../credentials.service";
import { sortById } from "../../utils/utils";
import { ActionControl, AlertService, Column, DataGridComponent, Pagination } from "@c8y/ngx-components";
import { UpdateableAlert } from "../../utils/UpdateableAlert";
import { DataClient } from "../../DataClient";
import { difference } from 'lodash';
import { DashboardNameCellRendererComponent } from './cell-renderer/dashboard-name-cell-renderer.component';

@Component({
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allDashboards: IManagedObject[] = [];

    selectedDashboardIds: string[] = [];

    columns: Column[] = [
        {
            name: 'id',
            header: 'ID',
            path: 'id',
            gridTrackSize: '0.5fr'
        },
        {
            name: 'nameDashboard',
            header: 'Name',
            filterable: false,
            sortable: false,
            cellRendererComponent: DashboardNameCellRendererComponent
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
            text: 'Open Dashboard',
            type: 'ACTION',
            icon: 'system-task',
            callback: ((dashboard: IManagedObject) => this.openDashboard(dashboard))
        },
        {
            text: 'View Managed Object',
            type: 'ACTION',
            icon: 'file',
            callback: ((dashboard: IManagedObject) => this.viewManagedObject(dashboard))
        }
    ];

    constructor(private dataService: DataService, private selectionService: SelectionService,
        private alertService: AlertService) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.updateSelectedDashboards();
    }

    onDashboardsSelected(selectedDashboardIds): void {
        selectedDashboardIds.forEach((selectedDashboardId) => {
            if (!this.isSelected(selectedDashboardId)) {
                this.selectDashboard(selectedDashboardId);
            }
        });

        const dashboardsToDeselect = difference(this.selectedDashboardIds, selectedDashboardIds);
        this.selectedDashboardIds = selectedDashboardIds;

        dashboardsToDeselect.forEach(dashboardToDeselect => this.selectionService.deselect(dashboardToDeselect));
    }

    private async load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allDashboards = await this.dataClient.getDashboards().then(db => sortById(db));
    }

    private updateSelectedDashboards(): void {
        this.allDashboards.forEach((dashboard) => {
            if (this.isSelected(dashboard.id)) {
                this.selectedDashboardIds.push(dashboard.id);
            }
        });

        this.dataGrid.setItemsSelected(this.selectedDashboardIds, true);
    }

    private async selectDashboard(dashboardId: string) {
        const alrt = new UpdateableAlert(this.alertService);
        this.selectionService.select(dashboardId);
        alrt.update(`Searching for linked Groups and Devices...`);
        const { groups, devices, simulators, smartRules, other, binaries, childParentLinks } = await this.dataClient.findLinkedFromDashboard((this.allDashboards).find(dashboard => dashboard.id === dashboardId));
        childParentLinks.forEach(({ child, parent }) => {
            this.selectionService.select(child, parent);
        });
        alrt.update(`Links found: ${groups.length} Groups, ${devices.length} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${binaries.length} Binaries, ${other.length} Other`);
        alrt.close(5000);
    }

    private isSelected(dashboardId: string) {
        return this.selectionService.isSelected(dashboardId);
    }

    private getDashboardUrl(dashboard: IManagedObject): string | undefined {
        const baseUrl = this.dataClient.getBaseUrl();
        if (!baseUrl) return undefined;

        const keyRegex = /^c8y_Dashboard!(device|group)!(\d+)$/
        const matchingKey = Object.keys(dashboard).find(key => keyRegex.test(key));
        if (matchingKey) {
            const [, groupOrDevice, deviceOrGroupId] = matchingKey.match(keyRegex);
            return `${baseUrl}/apps/cockpit/index.html#/${groupOrDevice}/${deviceOrGroupId}/dashboard/${dashboard.id}`;
        }
        return undefined;
    }

    private openDashboard(dashboard: IManagedObject) {
        console.log('open dashboard: ', dashboard);
        console.log('url: ', this.getDashboardUrl(dashboard));
        window.open(this.getDashboardUrl(dashboard), '_blank');
    }

    private viewManagedObject(managedObject: IManagedObject) {
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }
}
