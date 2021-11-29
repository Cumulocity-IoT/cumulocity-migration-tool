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
import { IEplFileConfiguration } from 'src/c8y-interfaces/IEplFileConfig';
import { difference } from 'lodash';

@Component({
    templateUrl: './epl-files.component.html'
})
export class EplFilesComponent implements OnInit {
    @ViewChild(DataGridComponent, { static: true })
    dataGrid: DataGridComponent;

    private dataClient: DataClient;

    allEplFiles: IEplFileConfiguration[];

    selectedEPLFileIds: string[] = [];

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
            name: 'state',
            header: 'State',
            path: 'state',
            filterable: true,
        }
    ];

    pagination: Pagination = {
        pageSize: 20,
        currentPage: 1,
    };

    actionControls: ActionControl[] = [
        {
            text: 'View EPL file',
            type: 'ACTION',
            icon: 'image-file',
            callback: ((eplFile: IEplFileConfiguration) => this.viewEplFile(eplFile))
        }
    ];

    constructor(private dataService: DataService, private selectionService: SelectionService,
        private alertService: AlertService) { }

    async ngOnInit(): Promise<void> {
        await this.load();
        this.updateSelectedEPLFiles();
    }

    async load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allEplFiles = await this.dataClient.getEplFiles(true).then(eplFile => sortById(eplFile));
    }

    updateSelectedEPLFiles(): void {
        this.allEplFiles.forEach((eplFile) => {
            if (this.isSelected(eplFile.id)) {
                this.selectedEPLFileIds.push(eplFile.id);
            }
        });

        this.dataGrid.setItemsSelected(this.selectedEPLFileIds, true);
    }

    async selectEPLFile(eplFileId: string): Promise<void> {
        const alrt = new UpdateableAlert(this.alertService);
        this.selectionService.select(eplFileId);
        alrt.update(`Epl file added for migration.`);
        alrt.close(2000);
    }

    isSelected(id: string): boolean {
        return this.selectionService.isSelected(id);
    }

    onEPLFilesSelected(selectedEPLFileIds): void {
        selectedEPLFileIds.forEach((selectedEPLFileId) => {
            if (!this.isSelected(selectedEPLFileId)) {
                this.selectEPLFile(selectedEPLFileId);
            }
        });

        const eplFilesToDeselect = difference(this.selectedEPLFileIds, selectedEPLFileIds);
        this.selectedEPLFileIds = selectedEPLFileIds;

        eplFilesToDeselect.forEach(eplFileToDeselect => this.selectionService.deselect(eplFileToDeselect));
    }

    viewEplFile(eplFile: IEplFileConfiguration): void {
        const blob = new Blob([eplFile.contents], {
            type: 'text/plain'
        });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
    }

    reload() {
        this.dataClient.invalidateCache();
        this.load();
    }
}
