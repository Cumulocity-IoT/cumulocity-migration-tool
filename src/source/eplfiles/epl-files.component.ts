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
import {sortById} from "../../utils/utils";
import {DataClient} from 'src/DataClient';
import {UpdateableAlert} from "../../utils/UpdateableAlert";
import {AlertService} from "@c8y/ngx-components";
import { IEplFileConfiguration } from 'src/c8y-interfaces/IEplFileConfig';

@Component({
    templateUrl: './epl-files.component.html'
})
export class EplFilesComponent {
    private dataClient: DataClient;
    
    allEplFiles: Promise<IEplFileConfiguration[]>;

    constructor(private dataService: DataService, private selectionService: SelectionService, private alertService: AlertService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allEplFiles = this.dataClient.getEplFiles(true).then(eplFile => sortById(eplFile));
    }

    async toggleSelection(eplFile: IEplFileConfiguration) {
        if (this.isSelected(eplFile)) {
            this.selectionService.deselect(eplFile.id);
        } else {
            const alrt = new UpdateableAlert(this.alertService);
            this.selectionService.select(eplFile.id);
            alrt.update(`Epl file added for migration.`);
            alrt.close(2000);
        }
    }

    isSelected(o: {id: string|number}) {
        return this.selectionService.isSelected(o.id);
    }

    trackById(index, value) {
        return value.id;
    }

    viewEplFile(event: MouseEvent, eplFile: IEplFileConfiguration) {
        event.stopPropagation();
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
