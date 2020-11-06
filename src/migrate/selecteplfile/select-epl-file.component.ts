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
import {Component, EventEmitter, Input, Output, ViewChild} from "@angular/core";
import {DataClient} from "../../DataClient";
import {DataService} from "../../data.service";
import {sortById} from "../../utils/utils";
import {IManagedObject} from "@c8y/client";
import {ModalDirective} from "ngx-bootstrap/modal";
import { IEplFileConfiguration } from "src/c8y-interfaces/IEplFileConfig";

@Component({
    templateUrl: './select-epl-file.component.html',
    selector: 'selectEplFile'
})
export class SelectEplFileComponent {
    @Input() selected: string;
    @Output() selectedChange: EventEmitter<string> = new EventEmitter<string>();

    @ViewChild(ModalDirective) modal: ModalDirective;

    private dataClient: DataClient;
    allEplFiles: Promise<IEplFileConfiguration[]>;

    constructor(private dataService: DataService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getDestinationDataClient();
        this.allEplFiles = this.dataClient.getEplFiles().then(eplFiles => sortById(eplFiles));
    }

    isSelected(eplFile: IEplFileConfiguration): boolean {
        return eplFile.id.toString() == this.selected;
    }

    toggleSelection(eplFile: IEplFileConfiguration) {
        if (this.isSelected(eplFile)) {
            this.selected = undefined;
        } else {
            this.selected = eplFile.id.toString();
        }
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

    open() {
        this.modal.show();
    }

    close(success: boolean = true) {
        if (success) {
            this.selectedChange.emit(this.selected);
        }
        this.modal.hide();
    }
}