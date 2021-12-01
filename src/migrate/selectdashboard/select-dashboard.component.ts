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
import { getDashboardName, sortById } from "../../utils/utils";
import { IManagedObject } from "@c8y/client";
import { BsModalRef } from "ngx-bootstrap/modal";
import { Subject } from "rxjs";
import { ActionControl, Column, DataGridComponent, Pagination } from "@c8y/ngx-components";

@Component({
    templateUrl: './select-dashboard.component.html',
    selector: 'selectDashboard'
})
export class SelectDashboardComponent implements OnInit {
    @Input() selected: string;

    onClose: Subject<string> = new Subject();

    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allDashboards: IManagedObject[];

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

    constructor(private dataService: DataService, private modalRef: BsModalRef) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.initSelectedDashboard();
    }

    async load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allDashboards = await this.dataClient.getDashboards().then(d => sortById(d));
    }

    initSelectedDashboard(): void {
        this.dataGrid.selectedItemIds = [this.selected];
    }

    isDashboardSelected(): boolean {
        return !!this.selected;
    }

    getDashboardName(dashboard: IManagedObject): string {
        return getDashboardName(dashboard);
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }

    onDashboardsSelected(selectedDashboardIds: string[]): void {
        if (selectedDashboardIds.length === 0) {
            this.selected = undefined;
            return;
        }

        const newlySelectedDashboardId = selectedDashboardIds.find((selectedDashboardId) => selectedDashboardId != this.selected);
        if (!newlySelectedDashboardId) {
            return;
        }

        this.dataGrid.selectedItemIds = [newlySelectedDashboardId];
        this.selected = newlySelectedDashboardId;
    }

    close(success: boolean = true) {
        if (success) {
            this.onClose.next(this.selected);
        }

        this.modalRef.hide();
    }

    viewManagedObject(managedObject: IManagedObject) {
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    getDashboardUrl(dashboard: IManagedObject): string | undefined {
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

    openDashboard(dashboard: IManagedObject) {
        window.open(this.getDashboardUrl(dashboard), '_blank');
    }
}