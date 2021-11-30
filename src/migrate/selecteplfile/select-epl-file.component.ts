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
import { IEplFileConfiguration } from "src/c8y-interfaces/IEplFileConfig";
import { Subject } from "rxjs";
import { ActionControl, Column, DataGridComponent, Pagination } from "@c8y/ngx-components";

@Component({
    templateUrl: './select-epl-file.component.html',
    selector: 'selectEplFile'
})
export class SelectEplFileComponent {
    @Input() selected: string;

    onClose: Subject<string> = new Subject();

    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allEPLFiles: IEplFileConfiguration[];

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
            callback: ((eplFile: IEplFileConfiguration) => this.viewEplFile(eplFile))
        }
    ];

    constructor(private dataService: DataService, private modalRef: BsModalRef) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.initSelectedEntry();
    }

    async load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allEPLFiles = await this.dataClient.getEplFiles().then(eplFiles => sortById(eplFiles));
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

    viewEplFile(eplFile: IEplFileConfiguration) {
        const blob = new Blob([eplFile.contents], {
            type: 'text/plain'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }
}