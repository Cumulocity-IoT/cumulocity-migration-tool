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
    templateUrl: './smart-rule.component.html'
})
export class SmartRuleComponent implements OnInit {
    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allSmartRules: IManagedObject[];

    selectedSmartRuleIds: string[] = [];

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
            icon: 'file-view',
            callback: ((smartRule: IManagedObject) => this.viewSmartRule(smartRule))
        },
        {
            text: 'View Managed Object',
            type: 'ACTION',
            icon: 'file',
            callback: ((smartRule: IManagedObject) => this.viewManagedObject(smartRule))
        }
    ];

    constructor(private dataService: DataService, private selectionService: SelectionService,
        private alertService: AlertService) { }
    
    async ngOnInit(): Promise<void> {
        await this.load();
        this.initSelectedSmartRules();
    }

    async load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allSmartRules = await this.dataClient.getSmartRules().then(d => sortById(d));
    }

    private initSelectedSmartRules(): void {
        this.allSmartRules.forEach((smartRule) => {
            if (this.isSelected(smartRule.id)) {
                this.selectedSmartRuleIds.push(smartRule.id);
            }
        });

        this.dataGrid.setItemsSelected(this.selectedSmartRuleIds, true);
    }

    onSmartRulesSelected(selectedSmartRuleIds): void {
        selectedSmartRuleIds.forEach((selectedSmartRuleId) => {
            if (!this.isSelected(selectedSmartRuleId)) {
                this.selectSmartRule(selectedSmartRuleId);
            }
        });

        const smartRulesToDeselect = difference(this.selectedSmartRuleIds, selectedSmartRuleIds);
        this.selectedSmartRuleIds = selectedSmartRuleIds;

        smartRulesToDeselect.forEach(smartRuleToDeselect => this.selectionService.deselect(smartRuleToDeselect));
    }

    private async selectSmartRule(smartRuleId) {
        const alrt = new UpdateableAlert(this.alertService);
        this.selectionService.select(smartRuleId);
        alrt.update(`Searching for linked Groups and Devices...`);
        const smartRule = this.allSmartRules.find(smartRule => smartRule.id === smartRuleId);
        const { groups, devices, simulators, smartRules, other, childParentLinks } = await this.dataClient.findLinkedFrom(smartRule);
        childParentLinks.forEach(({ child, parent }) => {
            this.selectionService.select(child, parent);
        });
        alrt.update(`Links found: ${groups.length} Groups, ${devices.length} Devices, ${simulators.length} Simulators, ${smartRules.length - 1} Smart Rules, ${other.length} Other`);
        alrt.close(5000);
    }

    isSelected(id: string) {
        return this.selectionService.isSelected(id);
    }

    private viewManagedObject(managedObject: IManagedObject) {
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    private viewSmartRule(smartRule: IManagedObject) {
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/cockpit/index.html#/device/${smartRule.c8y_Context.id}/info`, '_blank');
    }
}
