import { Component, OnDestroy, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { IApplication, IManagedObject } from '@c8y/client';
import download from "downloadjs";
import { BehaviorSubject, Subscription } from "rxjs";
import { DataService } from "../../data.service";
import { SelectionService } from "../../selection.service";
import { delay, sortById } from "../../utils/utils";
import { ActionControl, AlertService, Column, DataGridComponent, Pagination } from "@c8y/ngx-components";
import { UpdateableAlert } from "../../utils/UpdateableAlert";
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
import { DataClient } from "../../DataClient";
import { difference, uniqBy } from 'lodash';

@Component({
    templateUrl: './application.component.html'
})
export class ApplicationComponent implements OnInit, OnDestroy {
    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allApplications: (IApplication & { id: string | number, binary: IManagedObject } & { applicationBuilder?: any })[];

    filteredApplications: (IApplication & { id: string | number, binary: IManagedObject, downloading?: boolean })[];

    selectedApplicationIds: string[] = [];

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
            name: 'contextPath',
            header: 'Context Path',
            path: 'contextPath',
            sortable: false,
            filterable: false,
        },
        {
            name: 'binaryId',
            header: 'Binary ID',
            path: 'binary',
            sortable: false,
            filterable: false,
        },
        {
            name: 'size',
            header: 'Size',
            path: 'binary',
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
            text: 'Download Application',
            type: 'ACTION',
            icon: 'download-archive',
            callback: ((application: (IApplication & { id: string | number, binary: IManagedObject, downloading?: boolean })) => { this.downloadApplication(application) })
        },
        {
            text: 'Open Application',
            type: 'ACTION',
            icon: 'system-task',
            callback: ((application: IApplication) => { this.openApplication(application) })
        }
    ];

    showAll$: BehaviorSubject<boolean> = new BehaviorSubject(false);

    showAllSubscription: Subscription;

    private appSelectionInProgress = false;

    constructor(private dataService: DataService, private selectionService: SelectionService,
        private alertService: AlertService) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.updateSelectedApplications();
    }

    ngOnDestroy(): void {
        this.showAllSubscription.unsubscribe();
    }

    onApplicationsSelected(selectedApplicationIds: string[]): void {
        selectedApplicationIds.forEach((selectedApplicationeId) => {
            if (!this.isSelected(selectedApplicationeId)) {
                this.selectApplication(selectedApplicationeId);
            }
        });

        const applicationsToDeselect = difference(this.selectedApplicationIds, selectedApplicationIds);
        this.selectedApplicationIds = selectedApplicationIds;

        applicationsToDeselect.forEach(applicationToDeselect => this.selectionService.deselect(applicationToDeselect));
    }

    private async load(): Promise<void> {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allApplications = await this.dataClient.getApplicationsWithBinaries();
        this.showAllSubscription = this.showAll$.subscribe(showAll => {
            this.filteredApplications = sortById(this.allApplications.filter(app => showAll || app.binary || app.applicationBuilder));
        });
    }

    private updateSelectedApplications() {
        this.filteredApplications.forEach((application) => {
            if (this.isSelected(application.id.toString())) {
                this.selectedApplicationIds.push(application.id.toString());
            }
        });

        this.dataGrid.setItemsSelected(this.selectedApplicationIds, true);
    }

    private async selectApplication(applicationId: string): Promise<void> {
        if (this.appSelectionInProgress) {
            this.alertService.danger('Please wait for the current app processing to finish');
            return;
        }

        const app: (IApplication & { id: string | number, binary: IManagedObject }) =
            this.filteredApplications.find((application) => application.id === applicationId);

        this.appSelectionInProgress = true;

        const downloadAlert = new UpdateableAlert(this.alertService);
        this.selectionService.select(app.id);
        const {
            dashboards: linkedDashboards,
            devices: linkedDevicesFromApp
        } = await this.dataClient.findReferencedFromApplication(app, (progress) => {
            downloadAlert.update(`Searching for linked Dashboards, Groups and Devices...\nDownloading application: ${(progress * 100).toFixed(0)}%`);
        });
        downloadAlert.update(`Searching for linked Dashboards, Groups and Devices...\nExtracting and searching...`);
        let allGroups = [];
        let allDevices = [];
        let allSimulators = [];
        let allSmartRules = [];
        let allBinaries = [];
        let allOther = [];
        const dashboardCount = (await Promise.all(linkedDashboards.map(async dashboard => {
            this.selectionService.select(dashboard.id, app.id);
            const { devices, groups, simulators, smartRules, binaries, other, childParentLinks } = await this.dataClient.findLinkedFromDashboard(dashboard);
            childParentLinks.forEach(({ child, parent }) => {
                this.selectionService.select(child, parent);
            });
            allGroups.push(...groups);
            allDevices.push(...devices);
            allSimulators.push(...simulators);
            allSmartRules.push(...smartRules);
            allBinaries.push(...binaries);
            allOther.push(...other);
        }))).length;
        await Promise.all(linkedDevicesFromApp.map(async device => {
            this.selectionService.select(device.id, app.id);
            const { devices, groups, simulators, smartRules, other, childParentLinks } = await this.dataClient.findLinkedFrom(device);
            childParentLinks.forEach(({ child, parent }) => {
                this.selectionService.select(child, parent);
            });
            allGroups.push(...groups);
            allDevices.push(...devices);
            allSimulators.push(...simulators);
            allSmartRules.push(...smartRules);
            allOther.push(...other);
        }))
        allGroups = uniqBy(allGroups, group => group.id);
        allDevices = uniqBy(allDevices, device => device.id);
        allSimulators = uniqBy(allSimulators, simulator => simulator.id);
        allSmartRules = uniqBy(allSmartRules, smartRule => smartRule.id);
        allBinaries = uniqBy(allBinaries, binary => binary.id);
        allOther = uniqBy(allOther, other => other.id);

        downloadAlert.update(`Links found: ${dashboardCount} Dashboards, ${allGroups.length} Groups, ${allDevices.length} Devices, ${allSimulators.length} Simulators, ${allSmartRules.length} Smart Rules, ${allBinaries.length} Binaries, ${allOther.length} Other`);
        downloadAlert.close(5000);

        this.appSelectionInProgress = false;
    }

    isSelected(applicationId: string) {
        return this.selectionService.isSelected(applicationId);
    }

    reload() {
        this.showAllSubscription.unsubscribe();
        this.dataClient.invalidateCache();
        this.load();
    }

    private openApplication(app: IApplication) {
        event.stopPropagation();
        if (app.externalUrl) {
            window.open(app.externalUrl, '_blank');
        } else {
            const baseUrl = this.dataClient.getBaseUrl();
            window.open(`${baseUrl}/apps/${app.contextPath}`, '_blank');
        }
    }

    private async downloadApplication(app: (IApplication & { binary: IManagedObject, downloading?: boolean })) {
        if (app.downloading) {
            this.alertService.danger('Please wait for the current download to finish');
            return;
        }
        app.downloading = true;
        const downloadAlert = new UpdateableAlert(this.alertService);
        const blob = await this.dataClient.getApplicationBlob(app, progress => {
            downloadAlert.update(`Downloading... ${(progress * 100).toFixed(0)}%`);
        });
        downloadAlert.update('Opening...');
        download(blob, app.binary.name);
        await delay(4000);
        downloadAlert.close();
        app.downloading = false;
    }


}
