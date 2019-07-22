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
import {Component} from '@angular/core';
import {IManagedObject} from '@c8y/client';
import {DataService} from "../../data.service";
import {SelectionService} from "../../selection.service";
import {CredentialsService} from "../../credentials.service";
import {getDashboardName, sortById} from "../../utils/utils";
import {AlertService} from "@c8y/ngx-components";
import {UpdateableAlert} from "../../utils/UpdateableAlert";
import {DataClient} from "../../DataClient";

@Component({
    templateUrl: './dashboard.component.html'
})
export class DashboardComponent {
    private dataClient: DataClient;
    allDashboards: Promise<IManagedObject[]>;

    constructor(private dataService: DataService, private selectionService: SelectionService, private credSvc: CredentialsService, private alertService: AlertService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allDashboards = this.dataClient.getDashboards().then(db => sortById(db));
    }

    async toggleSelection(dashboard: IManagedObject) {
        if (this.isSelected(dashboard)) {
            this.selectionService.deselect(dashboard.id);
        } else {
            const alrt = new UpdateableAlert(this.alertService);
            this.selectionService.select(dashboard.id);
            alrt.update(`Searching for linked Groups and Devices...`);
            const {groups, devices, simulators, smartRules, other, binaries, childParentLinks} = await this.dataClient.findLinkedFromDashboard(dashboard);
            childParentLinks.forEach(({child, parent}) => {
                this.selectionService.select(child, parent);
            });
            alrt.update(`Links found: ${groups.length} Groups, ${devices.length} Devices, ${simulators.length} Simulators, ${smartRules.length} Smart Rules, ${binaries.length} Binaries, ${other.length} Other`);
            alrt.close(5000);
        }
    }

    isSelected(o: {id: string|number}) {
        return this.selectionService.isSelected(o.id);
    }

    trackById(index, value) {
        return value.id;
    }

    readonly getDashboardName = getDashboardName;

    viewManagedObject(event: MouseEvent, managedObject: IManagedObject) {
        event.stopPropagation();
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

    openDashboard(event: MouseEvent, dashboard: IManagedObject) {
        event.stopPropagation();
        window.open(this.getDashboardUrl(dashboard), '_blank');
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }
}
