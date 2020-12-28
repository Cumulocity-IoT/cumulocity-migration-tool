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
import { IManagedObject, Client } from '@c8y/client';
import { DataService } from "../../data.service";
import { SelectionService } from "../../selection.service";
import { sortById } from "../../utils/utils";
import { UpdateableAlert } from "../../utils/UpdateableAlert";
import { AlertService } from "@c8y/ngx-components";
import { DataClient } from 'src/DataClient';

@Component({
    templateUrl: './smartrest.component.html'
})
export class SmartRestTemplateComponent {
    private dataClient: DataClient;
    allSmartRestTemplates: Promise<IManagedObject[]>;

    constructor(private dataService: DataService, private selectionService: SelectionService, private alertService: AlertService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allSmartRestTemplates = this.dataClient.getSmartRestWithExternalIds().then(smartRestTemplate => sortById(smartRestTemplate));
    }

    async toggleSelection(template: IManagedObject) {
        if (this.isSelected(template)) {
            this.selectionService.deselect(template.id);
        } else {
            const alrt = new UpdateableAlert(this.alertService);
            this.selectionService.select(template.id);
            alrt.update(`Added Smart Rest Template '${template.name}'`);
            alrt.close(2500);
        }
    }

    isSelected(o: { id: string | number }) {
        return this.selectionService.isSelected(o.id);
    }

    trackById(index, value) {
        return value.id;
    }

    viewManagedObject(event: MouseEvent, managedObject: IManagedObject) {
        event.stopPropagation();
        const blob = new Blob([JSON.stringify(managedObject, undefined, 2)], {
            type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }

    async selectAll() {
        this.allSmartRestTemplates.then((templates) => {
            templates.forEach(template => {
                if (this.isSelected(template)) {
                    return;
                }

                this.toggleSelection(template);
            });
        });
    }

    async deselectAll() {
        this.allSmartRestTemplates.then((templates) => {
            templates.forEach(template => {
                if (!this.isSelected(template)) {
                    return;
                }

                this.toggleSelection(template);
            });
        });
    }
}
