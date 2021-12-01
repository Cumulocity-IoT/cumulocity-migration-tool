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
import { Component, EventEmitter, Input, Output, ViewChild } from "@angular/core";
import { DataClient } from "../../DataClient";
import { DataService } from "../../data.service";
import { sortById } from "../../utils/utils";
import { IManagedObject } from "@c8y/client";
import { BsModalRef } from "ngx-bootstrap/modal";
import { ActionControl, Column, DataGridComponent, Pagination } from "@c8y/ngx-components";
import { Subject } from "rxjs";

@Component({
    templateUrl: './select-binary.component.html',
    selector: 'selectBinary'
})
export class SelectBinaryComponent {
    @Input() selected: string;

    onClose: Subject<string> = new Subject();

    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allBinaries: IManagedObject[];

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
            text: 'View Managed Object',
            type: 'ACTION',
            icon: 'file',
            callback: ((binary: IManagedObject) => this.viewManagedObject(binary))
        }
    ];

    constructor(private dataService: DataService, private modalRef: BsModalRef) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.initSelectedEntry();
    }

    async load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allBinaries = await this.dataClient.getBinaries()
            .then(binaries => binaries.filter(b => !b.hasOwnProperty('c8y_applications_storage')))
            .then(d => sortById(d));
    }

    initSelectedEntry(): void {
        this.dataGrid.selectedItemIds = [this.selected];
    }

    isEntrySelected(): boolean {
        return !!this.selected;
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }

    onEntriesSelected(selectedEntryIds: string[]): void {
        if (selectedEntryIds.length === 0) {
            this.selected = undefined;
            return;
        }

        const newlySelectedEntryId = selectedEntryIds.find((selectedEntryId) => selectedEntryId != this.selected);
        if (!newlySelectedEntryId) {
            return;
        }

        this.dataGrid.selectedItemIds = [newlySelectedEntryId];
        this.selected = newlySelectedEntryId;
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
}