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
import {Component, EventEmitter, Input, OnDestroy, Output, ViewChild} from "@angular/core";
import {DataClient} from "../../DataClient";
import {DataService} from "../../data.service";
import {sortById} from "../../utils/utils";
import {IManagedObject, IApplication} from "@c8y/client";
import {ModalDirective} from "ngx-bootstrap/modal";
import {BehaviorSubject, Subscription} from "rxjs";
import {SelectionService} from "../../selection.service";

@Component({
    templateUrl: './select-application.component.html',
    selector: 'selectApplication'
})
export class SelectApplicationComponent implements OnDestroy{
    @Input() selected: string;
    @Output() selectedChange: EventEmitter<string> = new EventEmitter<string>();

    @ViewChild(ModalDirective) modal: ModalDirective;

    private dataClient: DataClient;
    showAll$: BehaviorSubject<boolean> = new BehaviorSubject(false);
    allApplications: Promise<(IApplication & {id: string|number, binary: IManagedObject} & {applicationBuilder?: any})[]>;
    filteredApplications: Promise<(IApplication & {id: string|number, binary: IManagedObject, downloading?:boolean})[]>;

    showAllSubscription: Subscription;

    constructor(private dataService: DataService, private selectionService: SelectionService) {
        this.load();
    }

    load() {
        this.dataClient = this.dataService.getSourceDataClient();
        this.allApplications = this.dataClient.getApplicationsWithBinaries();
        this.showAllSubscription = this.showAll$.subscribe(showAll => {
            this.filteredApplications = this.allApplications.then(apps => sortById(apps.filter(app => showAll || app.binary || app.applicationBuilder)));
        });
    }

    isSelected(app: {id: string|number}) {
        return app.id.toString() == this.selected;
    }

    toggleSelection(app: {id: string|number}) {
        if (this.isSelected(app)) {
            this.selected = undefined;
        } else {
            this.selected = app.id.toString();
        }
    }

    trackById(index, value) {
        return value.id;
    }

    getName(app: IApplication) {
        return app.name || '-';
    }

    openApplication(event: MouseEvent, app: IApplication) {
        event.stopPropagation();
        const baseUrl = this.dataClient.getBaseUrl();
        window.open(`${baseUrl}/apps/${app.contextPath}`, '_blank');
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

    ngOnDestroy(): void {
        this.showAllSubscription.unsubscribe();
    }
}